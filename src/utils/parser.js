export class ZCASParser {
  constructor(htmlContent) {
    this.parser = new DOMParser();
    this.doc = this.parser.parseFromString(htmlContent, 'text/html');
  }

  parse() {
    const table = this.doc.querySelector('table[bgcolor="#ffff80"]');
    if (!table) {
      console.error("Timetable table not found");
      return [];
    }

    const rows = Array.from(table.querySelectorAll('tr'));
    const events = [];
    
    // Timeline configuration based on ZCAS HTML structure
    // Key: Row Index (0-based)
    // Value: Start Time (h, m) and Duration in minutes
    const timeline = {
      2:  { h: 8,  m: 0, dur: 60 },
      3:  { h: 9,  m: 0, dur: 60 },
      4:  { h: 10, m: 0, dur: 60 },
      5:  { h: 11, m: 0, dur: 60 },
      6:  { h: 12, m: 0, dur: 60 },
      7:  { h: 13, m: 0, dur: 60 },
      8:  { h: 14, m: 0, dur: 60 },
      9:  { h: 15, m: 0, dur: 60 },
      10: { h: 16, m: 0, dur: 60 },
      11: { h: 17, m: 0, dur: 30 },
      // Row 12 is "Part-time" separator, no time
      13: { h: 17, m: 30, dur: 60 },
      14: { h: 18, m: 30, dur: 90 }
    };

    const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
    
    // Track occupied cells: string key "rowIndex-colIndex"
    const occupied = new Set();

    // Iterate through rows
    // We start at index 2 (08:00)
    for (let rIdx = 2; rIdx < rows.length; rIdx++) {
      // Skip the "Part-time" header row (Row 12) or any row not in timeline
      if (rIdx === 12 || !timeline[rIdx]) continue;

      const row = rows[rIdx];
      const cells = Array.from(row.querySelectorAll('td'));
      
      // The first cell is the time label (e.g., "08:00-09:00"), so we skip it for data
      // However, we need to be careful. DOM `tr` children `td` only include ACTUAL cells.
      // If a previous row had a rowspan, this row will have FEWER td elements.
      
      let currentTdIndex = 1; // Skip the first TD (Time Label)
      
      // Loop through columns (Days)
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        // Check if this slot is already occupied by a vertical span
        if (occupied.has(`${rIdx}-${dayIdx}`)) {
          continue;
        }

        // Retrieve the next available cell from the DOM
        if (currentTdIndex >= cells.length) break;
        
        const cell = cells[currentTdIndex];
        
        // Check for content
        // ZCAS empty cells usually have &nbsp; or whitespace
        const rawText = cell.innerText.trim();
        
        // If it's a real class, it usually has a link or bold text.
        // Let's check length and content.
        if (rawText.length > 5 && (cell.querySelector('b') || cell.querySelector('a'))) {
          // Found a class
          const content = this.cleanText(rawText);
          const rowspan = parseInt(cell.getAttribute('rowspan') || "1", 10);
          
          // Calculate duration
          let totalDuration = 0;
          let currentRowCalc = rIdx;
          
          for (let i = 0; i < rowspan; i++) {
            // If we hit the Part-time separator (row 12), skip it in calculation logic 
            // but we must advance the row counter if the span physically crosses it.
            // In ZCAS HTML, the rowspan seems to ignore the separator row visually 
            // or the separator row exists between time slots.
            // Let's assume standard flow:
            
            // Handle the gap at row 12
            if (currentRowCalc === 12) {
               currentRowCalc++; 
               // The separator row itself doesn't add time duration usually, 
               // but we need to check if the span INCLUDES it.
               // Looking at HTML, 17:00-17:30 is row 11. 17:30 is row 13.
               // If a class starts at 17:00 and has rowspan 2, it might mean 17:00-18:30?
               // Wait, row 11 is 30 mins. Row 13 is 1 hour.
               // If rowspan is 2 starting at row 11, it likely covers row 11 and row 13.
               // We will continue to the next valid time row.
            }

            const t = timeline[currentRowCalc];
            if (t) {
              totalDuration += t.dur;
            }
            currentRowCalc++;
          }

          // Extract details
          const details = this.extractDetails(cell.innerHTML); // Use innerHTML to parse links/br
          
          events.push({
            day: days[dayIdx],
            startTime: timeline[rIdx], // { h, m, dur }
            durationMinutes: totalDuration,
            ...details
          });

          // Mark future rows as occupied
          if (rowspan > 1) {
             let rFuture = rIdx + 1;
             let count = 1;
             while (count < rowspan) {
               if (rFuture === 12) {
                 rFuture++;
                 continue; // Skip marking the separator as occupied, it's not a data slot
               }
               occupied.add(`${rFuture}-${dayIdx}`);
               rFuture++;
               count++;
             }
          }
        }
        
        // We consumed a cell
        currentTdIndex++;
      }
    }

    return events;
  }

  cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  extractDetails(html) {
    // Structure often: <b><a ...>CODE - Name</a></b><br>Room<br>Lecturer<br>
    const el = document.createElement('div');
    el.innerHTML = html;
    
    const boldTag = el.querySelector('b');
    let subject = "Unknown Subject";
    if (boldTag) subject = boldTag.innerText.trim();

    // Remove the bold tag to get the rest
    if (boldTag) boldTag.remove();
    
    // The rest is usually Room <br> Lecturer
    // We can split by <br> or newlines
    const textNodes = el.innerText.split('\n').map(s => s.trim()).filter(s => s);
    
    let room = textNodes[0] || "Unknown Room";
    let lecturer = textNodes[1] || "";
    
    // Clean up subject (often has extra info like [Lab210...])
    // Example: "CIT3381 - Organizational and Societal Security"
    // Sometimes it has newlines in the link title.
    subject = subject.replace(/\n/g, ' ').replace(/\s+/g, ' ');

    return {
      subject,
      room,
      lecturer
    };
  }
}
