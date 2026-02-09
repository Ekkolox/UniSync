import { GoogleCalendarService } from './utils/google-calendar.js';

const ALARM_NAME = 'daily_sync';

// Initialize
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension Installed");
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1440 });
});

// Alarm Handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    runSyncProcess();
  }
});

// Message Handler
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
    // 0. Get URL from storage
    const data = await chrome.storage.local.get(['timetableUrl', 'university', 'calendarName', 'timezone']);
    const targetUrl = data.timetableUrl;
    const parserType = data.university || 'zcas'; // default
    const calName = data.calendarName || "UniSync Timetable";
    const tz = data.timezone || "Africa/Lusaka";

    if (!targetUrl) {
      throw new Error("No timetable URL set. Please open the extension popup and paste your URL.");
    }

    // 1. Fetch HTML
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error(`Failed to fetch page (${response.status}). Check the URL.`);
    const htmlText = await response.text();

    // 2. Parse HTML (via Offscreen)
    const events = await parseHtmlViaOffscreen(htmlText, parserType);
    if (!events || events.length === 0) {
      throw new Error("No classes found. Ensure the URL points to a valid timetable page.");
    }

    // 3. Sync to Google Calendar
    const calService = new GoogleCalendarService(calName, tz);
    const token = await calService.getAuthToken(false); 
    
    const calId = await calService.getOrCreateCalendar(token);
    await calService.clearFutureEvents(token, calId);
    
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
    
    if (error.message.includes('Authorization')) {
        await chrome.identity.removeCachedAuthToken({ token: error.token });
    }
    return { success: false, error: error.message };
  }
}

// Offscreen Helper
async function parseHtmlViaOffscreen(htmlContent, parserType) {
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

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'PARSE_TIMETABLE',
      data: htmlContent,
      parserType: parserType
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
