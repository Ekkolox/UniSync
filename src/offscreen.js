import { ZCASParser } from './utils/parser.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PARSE_TIMETABLE') {
    handleParse(message.data, sendResponse);
    return true; // Keep channel open for async response
  }
});

function handleParse(htmlContent, sendResponse) {
  try {
    const parser = new ZCASParser(htmlContent);
    const events = parser.parse();
    sendResponse({ success: true, events });
  } catch (error) {
    console.error("Parsing error:", error);
    sendResponse({ success: false, error: error.message });
  }
}
