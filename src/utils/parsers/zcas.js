export class ZCASParser {
  constructor(htmlContent) {
    this.parser = new DOMParser();
    this.doc = this.parser.parseFromString(htmlContent, 'text/html');
    this.timeline = {}; // Will be built dynamically
  }

  parse() {
    // Try to find the main schedule table
    // Strategy: Look for a table that contains "Monday" and "Tuesday"
    const tables = Array.from(this.doc.querySelectorAll('table'));
    let targetTable = null;
    let headerRowIndex = -1;

    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll('tr'));
      for (let i = 0; i < rows.length; i++) {
        const text = rows[i].innerText.toLowerCase();
        if (text.includes('monday') && text.includes('tuesday')) {
          targetTable = table;
          headerRowIndex = i;
          break;
        }
      }
      if (targetTable) break;
    }

    if (!targetTable) {
      console.error("Could not find a valid timetable grid.");
      return [];
    }

    const rows = Array.from(targetTable.querySelectorAll('tr'));
    
    // Build the timeline map dynamically from the first column of each row
    this.buildTimeline(rows, headerRowIndex);

    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    const occupied = new Set(); // Track occupied cells: "rowIndex-dayIndex"
    const events = [];

    // Iterate rows starting after the header
    for (let rIdx = headerRowIndex + 1; rIdx < rows.length; rIdx++) {
      // If this row doesn't have a valid time mapping, skip it (e.g., "Part-time" header)
      if (!this.timeline[rIdx]) continue;

      const row = rows[rIdx];
      const cells = Array.from(row.querySelectorAll('td'));
      
      // The first cell is the Time Label, so data starts at index 1
      // BUT, if previous rows had rowspans, the DOM 'td' list is shorter.
      let currentTdIndex = 1; 

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        // Check if blocked by vertical merge
        if (occupied.has(`${rIdx}-${dayIdx}`)) {
          continue;
        }

        if (currentTdIndex >= cells.length) break;
        const cell = cells[currentTdIndex];

        // Analyze content
        const rawText = cell.innerText.trim();
        const hasLinkOrBold = cell.querySelector('b') || cell.querySelector('a');
        
        // Heuristic: A valid class usually has >5 chars and some formatting
        if (rawText.length > 5 && hasLinkOrBold) {
          const content = this.cleanText(rawText);
          const rowspan = parseInt(cell.getAttribute('rowspan') || "1", 10);
          
          // Calculate total duration based on dynamic timeline
          let totalDuration = 0;
          let currentRowCalc = rIdx;
          
          for (let i = 0; i < rowspan; i++) {
            // Find the next VALID time row (skipping headers like "Part-time")
            while (currentRowCalc < rows.length && !this.timeline[currentRowCalc]) {
               // If we are strictly inside a span, we might need to count this gap?
               // Usually visual gaps in HTML tables don't add time.
               currentRowCalc++;
            }

            if (this.timeline[currentRowCalc]) {
              totalDuration += this.timeline[currentRowCalc].dur;
            }
            currentRowCalc++;
          }

          events.push({
            day: days[dayIdx],
            startTime: this.timeline[rIdx], // { h, m }
            durationMinutes: totalDuration,
            ...this.extractDetails(cell.innerHTML)
          });

          // Mark future spots as occupied
          if (rowspan > 1) {
            let rFuture = rIdx + 1;
            let count = 1;
            while (count < rowspan) {
              // Skip non-time rows for the occupation logic?
              // Standard HTML tables: yes, the row exists even if it's a header, 
              // but if the rowspan crosses it, we must account for it.
              // However, typically the rowspan count INCLUDES the separator row in the DOM structure.
              occupied.add(`${rFuture}-${dayIdx}`);
              rFuture++;
              count++;
            }
          }
        }
        
        currentTdIndex++;
      }
    }

    return events;
  }

  buildTimeline(rows, headerIdx) {
    this.timeline = {};
    const timeRegex = /(\d{1,2})[:\.](\d{2})\s*-\s*(\d{1,2})[:\.](\d{2})/; // Matches 08:00 - 09:00

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const firstCell = rows[i].querySelector('td');
      if (!firstCell) continue;

      const text = firstCell.innerText.trim();
      const match = text.match(timeRegex);

      if (match) {
        const startH = parseInt(match[1], 10);
        const startM = parseInt(match[2], 10);
        const endH = parseInt(match[3], 10);
        const endM = parseInt(match[4], 10);

        // Simple duration calc
        const startDate = new Date(2000, 0, 1, startH, startM);
        const endDate = new Date(2000, 0, 1, endH, endM);
        const diffMinutes = (endDate - startDate) / 60000;

        this.timeline[i] = {
          h: startH,
          m: startM,
          dur: diffMinutes > 0 ? diffMinutes : 60 // fallback
        };
      }
    }
  }

  cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  extractDetails(html) {
    const el = document.createElement('div');
    el.innerHTML = html;
    
    const boldTag = el.querySelector('b');
    let subject = "Unknown Subject";
    if (boldTag) subject = boldTag.innerText.trim();
    if (boldTag) boldTag.remove();
    
    const textNodes = el.innerText.split('\n').map(s => s.trim()).filter(s => s);
    let room = textNodes[0] || "Unknown Room";
    let lecturer = textNodes[1] || "";
    
    subject = subject.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    return { subject, room, lecturer };
  }
}
