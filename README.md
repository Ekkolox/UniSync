# ZCAS Timetable Sync Extension

This Chrome extension automatically scrapes your ZCAS cybersecurity timetable and syncs it to a dedicated Google Calendar.

## Setup Instructions

### 1. Get a Google Client ID
To allow the extension to access your calendar, you need a free Client ID from Google.
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "ZCAS Sync").
3. Go to **APIs & Services > Library**, search for **Google Calendar API**, and enable it.
4. Go to **APIs & Services > Credentials**.
5. Click **Create Credentials > OAuth client ID**.
6. Application type: **Chrome Extension**.
7. Name: "ZCAS Extension".
8. Item ID: You need the extension ID.
   - Open Chrome, go to `chrome://extensions`.
   - Turn on **Developer mode** (top right).
   - Click **Load unpacked** and select the `zcas-timetable-extension` folder.
   - Copy the **ID** (a long string of letters) from the card.
   - Paste this ID into the Google Cloud Console "Item ID" field.
9. Click **Create**. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).

### 2. Configure the Extension
1. Open the file `manifest.json` in the `zcas-timetable-extension` folder.
2. Find the line: `"client_id": "YOUR_CLIENT_ID_HERE"`
3. Replace `YOUR_CLIENT_ID_HERE` with the Client ID you just copied.
4. Save the file.

### 3. Finalize
1. Go back to `chrome://extensions`.
2. Click the **Refresh** icon on the ZCAS extension card.
3. Click the extension icon in your browser toolbar.
4. Click **Sync Now**.
5. Sign in with your Google account when prompted.

## Features
- **Daily Sync:** Checks for updates automatically once a day.
- **Smart Parsing:** Handles merged classes, 30-min slots, and Part-time separators.
- **Clean Calendar:** Creates a separate "ZCAS Timetable" calendar so your personal events stay safe.
