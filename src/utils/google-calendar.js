export class GoogleCalendarService {
  constructor() {
    this.calendarName = "ZCAS Timetable";
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
        description: "Automatically synced from ZCAS Timetable extension.",
        timeZone: "Africa/Lusaka" // Important for ZCAS
      })
    });
    const newCal = await createRes.json();
    return newCal.id;
  }

  async clearFutureEvents(token, calendarId) {
    // We strictly want to remove the recurring series we created.
    // We assume this calendar is OWNED by us, so we can wipe it or list events.
    // A safer way is to just delete the calendar and recreate it? 
    // No, that changes the color/settings the user might have set.
    // Better: List events (singleEvents=false) to get the recurring rules, and delete them.
    
    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?showDeleted=false&singleEvents=false`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    
    if (data.items) {
      const deletePromises = data.items.map(event => 
        fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${event.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        })
      );
      await Promise.all(deletePromises);
    }
  }

  async createEvent(token, calendarId, eventData) {
    // eventData: { day: "MONDAY", startTime: {h,m}, durationMinutes, subject, room, lecturer }
    
    // 1. Calculate the NEXT occurrence of this day
    const nextDate = this.getNextDayOfWeek(eventData.day, eventData.startTime);
    
    // 2. Format Start/End for API
    const startIso = nextDate.toISOString().replace(/\.\d{3}Z$/, ''); // simple ISO
    // Actually Google API wants "2023-10-27T10:00:00" (local time usually if timezone specified)
    // We will use the calendar's timezone "Africa/Lusaka"
    
    // Easier: Send standard ISO with timezone offset for Lusaka (CAT is UTC+2)
    // We'll trust the date object constructed in local browser time if user is in Zambia,
    // or manually construct the string.
    
    // Let's explicitly format for Lusaka (UTC+2) to be safe regardless of where the user's computer is.
    const lusakaOffset = 2; 
    const startDateTime = this.formatToLusakaTime(nextDate);
    
    // Calculate End Time
    const endDate = new Date(nextDate.getTime() + eventData.durationMinutes * 60000);
    const endDateTime = this.formatToLusakaTime(endDate);

    const eventBody = {
      summary: eventData.subject,
      location: eventData.room,
      description: `Lecturer: ${eventData.lecturer}`,
      start: {
        dateTime: startDateTime,
        timeZone: "Africa/Lusaka"
      },
      end: {
        dateTime: endDateTime,
        timeZone: "Africa/Lusaka"
      },
      recurrence: [
        "RRULE:FREQ=WEEKLY"
      ]
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

  // Helper to find the next "MONDAY" at "08:00"
  getNextDayOfWeek(dayName, timeObj) {
    const dayMap = {
      "SUNDAY": 0, "MONDAY": 1, "TUESDAY": 2, "WEDNESDAY": 3, 
      "THURSDAY": 4, "FRIDAY": 5, "SATURDAY": 6
    };
    const targetDay = dayMap[dayName.toUpperCase()];
    
    const now = new Date();
    // Convert now to Lusaka time conceptually
    // We just want to find the next date.
    
    const d = new Date();
    d.setDate(d.getDate() + (targetDay + 7 - d.getDay()) % 7);
    d.setHours(timeObj.h, timeObj.m, 0, 0);
    
    // If today is the day but the time has passed, maybe skip to next week?
    // For a timetable, it's better to just ensure we start from the nearest valid slot.
    // If we are generating the Recurrence Rule, the start date defines the first instance.
    return d;
  }

  formatToLusakaTime(dateObj) {
    // Returns "YYYY-MM-DDTHH:mm:ss" formatted for local time, 
    // but effectively we are forcing the numbers to match what we want.
    // Since we setHours() above on the local object, 'dateObj' holds the correct wall-clock numbers.
    const pad = n => n < 10 ? '0' + n : n;
    return `${dateObj.getFullYear()}-${pad(dateObj.getMonth()+1)}-${pad(dateObj.getDate())}T${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:00`;
  }
}
