// Helpers for the optional "valid until" date on running announcements.
// Dates are plain YYYY-MM-DD strings (the same shape an <input type="date">
// produces), so they can be compared lexicographically without any
// timezone conversion surprises.

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];

export function parseAnnouncementDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  // Reject impossible calendar dates such as 2026-02-31, which Date would
  // silently roll over into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function isValidAnnouncementDate(value: string): boolean {
  return parseAnnouncementDate(value) !== null;
}

/** "2026-11-14" -> "Jumat, 14 Nov 2026"; returns null for missing/invalid values. */
export function formatAnnouncementDate(value: string | null | undefined): string | null {
  const date = parseAnnouncementDate(value);
  if (!date) return null;
  return `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

export function todayDateString(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** An announcement is expired once its last valid day has fully passed. */
export function isAnnouncementExpired(validUntil: string | null | undefined, today = todayDateString()): boolean {
  if (!validUntil || !isValidAnnouncementDate(validUntil)) return false;
  return validUntil < today;
}
