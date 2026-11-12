// "Which lesson is running right now" helpers for the Jadwal Hari Ini card.
// All "now" values are taken in the Asia/Jakarta timezone explicitly (via
// Intl.DateTimeFormat with timeZone), never from the visitor's device
// timezone: the school is in WIB, so a phone set to another timezone must
// still mark the lesson that is actually running in Pasirian. This mirrors
// the server, which already pins JAKARTA_TIME_ZONE = 'Asia/Jakarta' in
// src/index.ts. Ongoing uses the entry's own timeStart/timeEnd from the API
// ("HH:MM" strings): start <= now < end.

const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

const weekdayFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: JAKARTA_TIME_ZONE,
  weekday: 'long',
});

const timePartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: JAKARTA_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export interface JakartaNow {
  /** Indonesian weekday name in Jakarta, e.g. "Kamis" — same shape as ScheduleItem.day. */
  dayName: string;
  /** Minutes since midnight in Jakarta, 0–1439. */
  minutesSinceMidnight: number;
}

export function getJakartaNow(now: Date = new Date()): JakartaNow {
  const parts = timePartsFormatter.formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0') % 24;
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return {
    dayName: weekdayFormatter.format(now),
    minutesSinceMidnight: hour * 60 + minute,
  };
}

/** "08:25" -> 505; returns null for anything that is not an HH:MM clock time. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * A lesson is ongoing from its own start time (inclusive) until its own end
 * time (exclusive). Breaks between lessons and times outside the school day
 * therefore mark nothing.
 */
export function isScheduleOngoing(
  schedule: { timeStart: string; timeEnd: string },
  minutesSinceMidnight: number,
): boolean {
  const start = parseTimeToMinutes(schedule.timeStart);
  const end = parseTimeToMinutes(schedule.timeEnd);
  if (start === null || end === null) return false;
  return start <= minutesSinceMidnight && minutesSinceMidnight < end;
}
