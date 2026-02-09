import { GoogleCalendarService } from './utils/google-calendar.js';

const ALARM_NAME = 'daily_sync';
const TIMETABLE_URL = 'https://zcasu.edu.zm/timetables/alltimetables/x3001bsccs313224.htm';

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed");
  // Create an alarm to check once a day (periodInMinutes: 1440)
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1440 });
});

// Alarm Handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runSyncProcess();
  }
});

// Message Handler (from Popup)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_SYNC') {
    runSyncProcess()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.toString() }));
    return true; // async
  }
});

async function runSyncProcess() {
  try {
    // 1. Fetch HTML
    const response = await fetch(TIMETABLE_URL);
    if (!response.ok) throw new Error("Failed to fetch timetable page.");
    const htmlText = await response.text();

    // 2. Parse HTML (via Offscreen)
    const events = await parseHtmlViaOffscreen(htmlText);
    if (!events || events.length === 0) {
      throw new Error("No events found in timetable. Check if URL structure changed.");
    }

    // 3. Sync to Google Calendar
    const calService = new GoogleCalendarService();
    // Non-interactive token for background sync. 
    // If it fails (user revoked), we can't show prompt in background.
    // Ideally, we catch this and set an error state in storage.
    const token = await calService.getAuthToken(false); 
    
    const calId = await calService.getOrCreateCalendar(token);
    
    // Clear old
    await calService.clearFutureEvents(token, calId);
    
    // Create new
    for (const ev of events) {
      await calService.createEvent(token, calId, ev);
    }

    // 4. Update Status
    await chrome.storage.local.set({ 
      lastSync: new Date().toLocaleString(),
      status: 'Success'
    });

    return { success: true };

  } catch (error) {
    console.error("Sync failed:", error);
    await chrome.storage.local.set({ 
      lastSync: new Date().toLocaleString(),
      status: `Error: ${error.message}`
    });
    // If token error, we might need re-auth next time popup opens
    if (error.message.includes('Authorization')) {
        await chrome.identity.removeCachedAuthToken({ token: error.token });
    }
    return { success: false, error: error.message };
  }
}

// Offscreen Helper
async function parseHtmlViaOffscreen(htmlContent) {
  // Ensure offscreen document exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse timetable HTML'
    });
  }

  // Send message
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'PARSE_TIMETABLE',
      data: htmlContent
    }, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (response && response.success) {
        resolve(response.events);
      } else {
        reject(new Error(response?.error || "Unknown parsing error"));
      }
    });
  });
}
