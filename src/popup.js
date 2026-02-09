document.addEventListener('DOMContentLoaded', init);
document.getElementById('saveSyncBtn').addEventListener('click', startSync);

function init() {
  // Load saved data
  chrome.storage.local.get(['timetableUrl', 'lastSync', 'status', 'university', 'calendarName', 'timezone'], (data) => {
    if (data.timetableUrl) document.getElementById('timetableUrl').value = data.timetableUrl;
    if (data.university) document.getElementById('university').value = data.university;
    if (data.calendarName) document.getElementById('calendarName').value = data.calendarName;
    if (data.timezone) document.getElementById('timezone').value = data.timezone;
    
    if (data.lastSync) {
      document.getElementById('lastSync').textContent = `Last: ${data.lastSync}`;
    }
    
    if (data.status) {
      const el = document.getElementById('statusText');
      el.textContent = data.status;
      updateStatusColor(el, data.status);
    }
  });
}

function updateStatusColor(el, status) {
  el.className = '';
  if (status.startsWith('Error')) el.className = 'error';
  else if (status === 'Success') el.className = 'success';
}

function startSync() {
  const urlInput = document.getElementById('timetableUrl');
  const url = urlInput.value.trim();
  const university = document.getElementById('university').value;
  const calendarName = document.getElementById('calendarName').value.trim() || "UniSync Timetable";
  const timezone = document.getElementById('timezone').value;

  const btn = document.getElementById('saveSyncBtn');
  const statusEl = document.getElementById('statusText');

  if (!url) {
    statusEl.textContent = "Error: Please enter a URL first.";
    statusEl.className = 'error';
    return;
  }

  // Validate URL basic format
  if (!url.startsWith('http')) {
    statusEl.textContent = "Error: URL must start with http/https";
    statusEl.className = 'error';
    return;
  }

  btn.disabled = true;
  btn.textContent = "Saving...";

  // Save URL first
  chrome.storage.local.set({ 
    timetableUrl: url,
    university: university,
    calendarName: calendarName,
    timezone: timezone
  }, () => {
    btn.textContent = "Authorizing...";
    
    // Auth Flow
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        statusEl.textContent = "Auth Failed: " + (chrome.runtime.lastError?.message || "Unknown");
        statusEl.className = 'error';
        btn.disabled = false;
        btn.textContent = "Save & Sync Now";
        return;
      }

      // Trigger Background Sync
      statusEl.textContent = "Fetching & Parsing...";
      chrome.runtime.sendMessage({ action: 'START_SYNC' }, (response) => {
        btn.disabled = false;
        btn.textContent = "Save & Sync Now";
        
        if (response && response.success) {
          statusEl.textContent = "Success";
          statusEl.className = 'success';
          document.getElementById('lastSync').textContent = "Last: " + new Date().toLocaleString();
        } else {
          statusEl.textContent = "Error: " + (response?.error || "Unknown error");
          statusEl.className = 'error';
        }
      });
    });
  });
}
