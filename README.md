# UniSync: Universal Timetable Sync

**UniSync** is a smart, adaptable Chrome Extension that scrapes your university timetable and syncs it directly to your Google Calendar. 

It ensures you never miss a class by keeping your schedule up-to-date automatically, handling complex timetable layouts, merged cells, and timezone conversions.

## 📖 The Story Behind UniSync

This project started as a personal tool to help me manage my schedule at **ZCAS (Zambia Centre for Accountancy Studies)**. I realized that manually entering classes into my calendar was tedious and prone to errors, especially when the timetable changed.

After building a robust parser for my own use, I decided to evolve the project into **UniSync**. The goal was to make the architecture **adaptable and smart**, allowing students from *other* universities to easily plug in their own parsing logic without rewriting the entire extension. 

Today, it stands as a modular platform that anyone can extend!

## ✨ Features

-   **Multi-University Support:** Currently supports ZCAS, with a modular "Parser Factory" architecture to easily add others.
-   **Smart Parsing:** Handles complex HTML tables, merged cells (long lectures), and irregular time slots.
-   **Customizable:** Choose your university, set a custom calendar name, and define your timezone.
-   **Automatic Sync:** Runs daily in the background to catch any schedule changes.
-   **Safe:** Creates a separate calendar (default: "UniSync Timetable") so it never messes with your personal events.

## 🚀 How to Use

### 1. Installation
1.  Clone or download this repository.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable **Developer mode** (top right toggle).
4.  Click **Load unpacked** and select the `zcas-timetable-extension` folder from this project.

### 2. Google API Setup (One-time)
To allow the extension to write to your calendar, you need a Client ID.
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a project and enable the **Google Calendar API**.
3.  Create **OAuth credentials** for a "Chrome Extension".
4.  Copy the **Extension ID** from your `chrome://extensions` page and paste it into the "Item ID" field in the console.
5.  Copy the generated **Client ID**.
6.  Open `manifest.json` in this project and paste your Client ID into the `client_id` field.
7.  Reload the extension in Chrome.

### 3. Syncing Your Timetable
1.  Log in to your university student portal and open your timetable page.
2.  Copy the **URL** of that page.
3.  Click the **UniSync icon** in your browser toolbar.
4.  Select your **University** (e.g., ZCAS).
5.  (Optional) Customize the **Calendar Name** and **Timezone**.
6.  Paste the URL and click **Save & Sync Now**.
7.  Authorize with Google when prompted.
8.  Done! Your classes will appear in your Google Calendar shortly.

## ❓ Frequently Asked Questions (FAQ)

**Q: Can I use this for a university other than ZCAS?**
A: Yes, but you (or a developer) need to write a parser for it! The code is modular. You just need to add a new file in `src/utils/parsers/` and register it in `src/utils/parser.js`.

**Q: Will this delete my existing calendar events?**
A: **No.** UniSync only touches the specific calendar it creates (e.g., "UniSync Timetable"). It clears *future* events in that specific calendar before re-syncing to avoid duplicates, but your personal "Primary" calendar remains untouched.

**Q: How often does it sync?**
A: The extension creates a background alarm to run the sync process automatically **once every 24 hours**, as long as Chrome is open.

**Q: Why do I need to create my own Google Cloud Project?**
A: Since this is a developer/sideloaded extension, it cannot share a published Client ID. Creating your own free ID ensures you have full control and access.

## 🛠️ For Developers: Adding a New University

1.  Create `src/utils/parsers/myUniversity.js`.
2.  Implement a class with a `parse()` method that returns an array of event objects: `{ day, startTime: {h, m}, durationMinutes, subject, room, lecturer }`.
3.  Import it in `src/utils/parser.js` and add it to the `ParserFactory`.
4.  Add the option to `src/popup.html`.

---
*Built with ❤️ by ekkoloxx*
