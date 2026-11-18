// Dates in the organisation's time zone (default Asia/Kolkata).
//
// Lesson 4 (docs/context/07-lessons.md): never take "today" or the year from
// the server's UTC clock. `new Date().toISOString().split("T")[0]` is the UTC
// date and is wrong between 00:00 and 05:30 IST.
//
// On screen: DD-MM-YYYY. In exports and the database: ISO 8601 (YYYY-MM-DD).

export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

type Parts = { year: string; month: string; day: string };

function partsInZone(instant: Date, timeZone: string): Parts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((p) => p.type === type)?.value;
    if (!value) throw new Error(`Could not read ${type} for time zone ${timeZone}`);
    return value;
  };

  return { year: get("year"), month: get("month"), day: get("day") };
}

/** Today's calendar date in the zone, as ISO `YYYY-MM-DD`. */
export function todayIso(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): string {
  const { year, month, day } = partsInZone(now, timeZone);
  return `${year}-${month}-${day}`;
}

/** The calendar year in the zone: the year baked into numbers such as SR-2026-0001. */
export function yearInZone(timeZone: string = DEFAULT_TIME_ZONE, now: Date = new Date()): number {
  return Number(partsInZone(now, timeZone).year);
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Format for screens as DD-MM-YYYY.
 * - A `YYYY-MM-DD` string (a database `date`) is a calendar date: it is
 *   reformatted as-is, with no time-zone shift.
 * - A Date or a timestamp string (`timestamptz`) is an instant: it is shown as
 *   the calendar date in the zone.
 * Returns "" for null/undefined so empty cells stay empty.
 */
export function formatDate(
  value: string | Date | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string") {
    const m = ISO_DATE.exec(value);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  }

  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Not a date: ${String(value)}`);
  }
  const { year, month, day } = partsInZone(instant, timeZone);
  return `${day}-${month}-${year}`;
}

/** Clock time in the zone, 24-hour `HH:mm` (09:42). "" for null/undefined. */
export function formatTime(
  value: string | Date | null | undefined,
  timeZone: string = DEFAULT_TIME_ZONE,
): string {
  if (value === null || value === undefined || value === "") return "";
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Not a date: ${String(value)}`);
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(instant);
}

/** The ISO calendar date one day before `iso` (YYYY-MM-DD in, out). */
export function previousIsoDate(iso: string): string {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Reads a date typed on screen as DD-MM-YYYY (also DD/MM/YYYY or DD.MM.YYYY,
 * one-digit day or month allowed) and returns ISO `YYYY-MM-DD`, or null when
 * it isn't a real calendar date (31-02-2026, 00-01-2026…).
 */
export function parseDisplayDate(input: string): string | null {
  const m = /^\s*(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\s*$/.exec(input);
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900 || year > 2999 || month < 1 || month > 12 || day < 1) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > daysInMonth) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Whole days from ISO date `a` to ISO date `b` (negative when b is earlier). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (iso: string) => {
    const m = ISO_DATE.exec(iso);
    if (!m) throw new Error(`Not an ISO date: ${iso}`);
    return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

/** ISO date `iso` plus `days` calendar days (negative goes back). */
export function addDays(iso: string, days: number): string {
  const m = ISO_DATE.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days));
  return d.toISOString().slice(0, 10);
}
