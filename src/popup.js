document.addEventListener('DOMContentLoaded', restoreStatus);
document.getElementById('syncBtn').addEventListener('click', startSync);

function restoreStatus() {
  chrome.storage.local.get(['lastSync', 'status'], (data) => {
    if (data.lastSync) {
      document.getElementById('lastSync').textContent = data.lastSync;
    }
    if (data.status) {
      const el = document.getElementById('statusText');
      el.textContent = data.status;
      if (data.status.startsWith('Error')) el.className = 'error';
      else if (data.status === 'Success') el.className = 'success';
      else el.className = '';
    }
  });
}

function startSync() {
  const btn = document.getElementById('syncBtn');
  const statusEl = document.getElementById('statusText');
  
  btn.disabled = true;
  btn.textContent = "Syncing...";
  statusEl.textContent = "Authorizing...";
  
  // 1. Interactive Auth
  chrome.identity.getAuthToken({ interactive: true }, (token) => {
    if (chrome.runtime.lastError || !token) {
      statusEl.textContent = "Auth Failed: " + (chrome.runtime.lastError?.message || "Unknown");
      statusEl.className = 'error';
      btn.disabled = false;
      btn.textContent = "Sync Now";
      return;
    }

    // 2. Token acquired, tell background to run logic
    statusEl.textContent = "Fetching & Parsing...";
    
    chrome.runtime.sendMessage({ action: 'START_SYNC' }, (response) => {
      btn.disabled = false;
      btn.textContent = "Sync Now";
      
      if (response && response.success) {
        statusEl.textContent = "Success";
        statusEl.className = 'success';
        document.getElementById('lastSync').textContent = new Date().toLocaleString();
      } else {
        statusEl.textContent = "Error: " + (response?.error || "Unknown error");
        statusEl.className = 'error';
      }
    });
  });
}
