import { ParserFactory } from './utils/parser.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'PARSE_TIMETABLE') {
    handleParse(message.data, message.parserType, sendResponse);
    return true; // Keep channel open for async response
  }
});

function handleParse(htmlContent, parserType, sendResponse) {
  try {
    const parser = ParserFactory.getParser(parserType, htmlContent);
    const events = parser.parse();
    sendResponse({ success: true, events });
  } catch (error) {
    console.error("Parsing error:", error);
    sendResponse({ success: false, error: error.message });
  }
}
