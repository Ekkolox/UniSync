export class GoogleCalendarService {
  constructor(calendarName = "UniSync Timetable", timeZone) {
    this.calendarName = calendarName;
    // Use provided timezone or fallback to system timezone
    this.timeZone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  async getAuthToken(interactive = false) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError || !token) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  async getOrCreateCalendar(token) {
    // 1. List calendars to find ours
    const listUrl = "https://www.googleapis.com/calendar/v3/users/me/calendarList";
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const listData = await listRes.json();
    
    const existing = listData.items.find(c => c.summary === this.calendarName);
    if (existing) {
      return existing.id;
    }

    // 2. Create if not exists
    const createUrl = "https://www.googleapis.com/calendar/v3/calendars";
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: this.calendarName,
        description: "Automatically synced from UniSync extension.",
        timeZone: this.timeZone
      })
    });
    const newCal = await createRes.json();
    return newCal.id;
  }

  async syncEvents(token, calendarId, newEvents) {
    // 1. Fetch ALL existing future/recurring events from this calendar
    // singleEvents=false returns the underlying recurring series
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?showDeleted=false&singleEvents=false`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const existingEvents = data.items || [];

    // 2. Prepare for tracking
    const eventsToCreate = [];
    const eventsToUpdate = [];
    const eventsToDelete = [];
    const matchedEventIds = new Set();

    // 3. Compare New vs Existing
    for (const newEv of newEvents) {
      // Find a match in existingEvents
      const match = existingEvents.find(ex => {
        if (matchedEventIds.has(ex.id)) return false; // Already matched
        return this.isSameEvent(newEv, ex);
      });

      if (match) {
        // Found a duplicate/existing class.
        matchedEventIds.add(match.id);
        
        // Check if details changed (Room or Lecturer)
        // Note: Google Calendar location might be undefined if empty
        const currentLoc = match.location || "";
        const newLoc = newEv.room || "";
        const currentDesc = match.description || "";
        const newDesc = `Lecturer: ${newEv.lecturer}`;

        if (currentLoc !== newLoc || currentDesc !== newDesc) {
           eventsToUpdate.push({ id: match.id, data: newEv });
        }
      } else {
        // No match found -> It's a new class
        eventsToCreate.push(newEv);
      }
    }

    // 4. Identify Orphans (Events in Calendar that are NOT in the new list)
    for (const ex of existingEvents) {
      if (!matchedEventIds.has(ex.id)) {
        eventsToDelete.push(ex.id);
      }
    }

    // 5. Execute Changes
    console.log(`Sync Summary: Creating ${eventsToCreate.length}, Updating ${eventsToUpdate.length}, Deleting ${eventsToDelete.length}`);

    // Batch Delete
    const deletePromises = eventsToDelete.map(id => 
      fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
    );
    await Promise.all(deletePromises);

    // Batch Update
    for (const item of eventsToUpdate) {
        await this.updateEvent(token, calendarId, item.id, item.data);
    }

    // Batch Create
    for (const ev of eventsToCreate) {
      await this.createEvent(token, calendarId, ev);
    }
  }

  isSameEvent(parsedEv, gCalEv) {
    // parsedEv: { day: "MONDAY", startTime: {h,m}, subject, ... }
    // gCalEv: { summary: "Subject", start: { dateTime: "..." }, ... }

    // 1. Check Subject
    if (parsedEv.subject !== gCalEv.summary) return false;

    // 2. Check Day and Time
    if (!gCalEv.start || !gCalEv.start.dateTime) return false;

    const gDate = new Date(gCalEv.start.dateTime);
    // Note: gDate is constructed from the string.
    
    const dayMap = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const gDayName = dayMap[gDate.getDay()];
    
    if (gDayName !== parsedEv.day.toUpperCase()) return false;

    const gH = gDate.getHours();
    const gM = gDate.getMinutes();

    if (gH !== parsedEv.startTime.h || gM !== parsedEv.startTime.m) return false;

    return true;
  }

  async createEvent(token, calendarId, eventData) {
    // eventData: { day: "MONDAY", startTime: {h,m}, durationMinutes, subject, room, lecturer }
    
    // 1. Calculate the NEXT occurrence
    const nextDate = this.getNextDayOfWeek(eventData.day, eventData.startTime);
    
    // 2. Format Start/End for API
    const startDateTime = this.formatToLocalTime(nextDate);
    
    // Calculate End Time
    const endDate = new Date(nextDate.getTime() + eventData.durationMinutes * 60000);
    const endDateTime = this.formatToLocalTime(endDate);

    const eventBody = {
      summary: eventData.subject,
      location: eventData.room,
      description: `Lecturer: ${eventData.lecturer}`,
      start: {
        dateTime: startDateTime,
        timeZone: this.timeZone
      },
      end: {
        dateTime: endDateTime,
        timeZone: this.timeZone
      },
      recurrence: [
        "RRULE:FREQ=WEEKLY"
      ],
      colorId: this.getColorIdForSubject(eventData.subject)
    };

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventBody)
    });
  }

  getColorIdForSubject(subject) {
    if (!subject) return "1"; // Default Lavender
    let hash = 0;
    for (let i = 0; i < subject.length; i++) {
      hash = subject.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Map to 1-11
    const colorIndex = (Math.abs(hash) % 11) + 1;
    return colorIndex.toString();
  }

  async updateEvent(token, calendarId, eventId, eventData) {
    // Similar to create, but using PATCH to update fields
    // We only update what changes usually, but here we can just overwrite the main fields to be safe.
    // However, we must preserve the start/end times if we don't want to shift them (though if the slot is the same, time is the same).
    
    // Actually, createEvent calculates the "Next Date". If we update, do we move it?
    // No, we should probably keep the existing time/recurrence and just update metadata.
    // But if we want to ensure it matches the timetable EXACTLY, we regenerate the body.
    
    // Re-calculating dates might move the event to next week if today passed? 
    // That's risky for an update. 
    // SAFEST: Just update Summary, Location, Description, Color.
    
    const eventBody = {
      summary: eventData.subject,
      location: eventData.room,
      description: `Lecturer: ${eventData.lecturer}`,
      colorId: this.getColorIdForSubject(eventData.subject)
    };

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`;
    await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(eventBody)
    });
  }

  // Helper to find the next "MONDAY" at "08:00"
  getNextDayOfWeek(dayName, timeObj) {
    const dayMap = {
      "SUNDAY": 0, "MONDAY": 1, "TUESDAY": 2, "WEDNESDAY": 3, 
      "THURSDAY": 4, "FRIDAY": 5, "SATURDAY": 6
    };
    const targetDay = dayMap[dayName.toUpperCase()];
    
    const d = new Date();
    let daysToAdd = (targetDay - d.getDay() + 7) % 7;
    
    // If it's today and time passed, we still use today for the RRULE start anchor 
    // to keep it simple, or we could jump to next week. 
    // Given the requirement to "counter check", ensuring the anchor is the nearest valid day (even if missed) is safer for RRULE consistency.
    
    d.setDate(d.getDate() + daysToAdd);
    d.setHours(timeObj.h, timeObj.m, 0, 0);
    return d;
  }

  formatToLocalTime(dateObj) {
    // Returns "YYYY-MM-DDTHH:mm:ss" formatted for the *local* time values in dateObj
    const pad = n => n < 10 ? '0' + n : n;
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;
  }
}
