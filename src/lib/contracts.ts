import { daysBetween } from "@/lib/dates";

// The state of an AMC or warranty contract for screens (owner, 18-11-2026:
// contracts cover one or more assets; built with Assets). Dates are ISO
// calendar dates; "today" is the client's today (pass todayIso(timeZone)).
// Not renewing and Renewed are added with the contracts table.

export type CoverState = "upcoming" | "active" | "ends_soon" | "ended";

/** Days before the end when a contract shows as "Ends soon". The Warranty &
 *  AMC module makes its reminder days a setting; this is the list's cue. */
export const ENDS_SOON_DAYS = 30;

export function coverState(
  period: { startsOn: string | null; endsOn: string | null },
  today: string,
): { state: CoverState; daysLeft: number | null } {
  if (period.startsOn && daysBetween(today, period.startsOn) > 0) {
    return { state: "upcoming", daysLeft: period.endsOn ? daysBetween(today, period.endsOn) : null };
  }
  if (!period.endsOn) return { state: "active", daysLeft: null };
  const daysLeft = daysBetween(today, period.endsOn);
  if (daysLeft < 0) return { state: "ended", daysLeft };
  if (daysLeft <= ENDS_SOON_DAYS) return { state: "ends_soon", daysLeft };
  return { state: "active", daysLeft };
}

export const COVER_LABEL: Record<CoverState, string> = {
  upcoming: "Starts later",
  active: "Active",
  ends_soon: "Ends soon",
  ended: "Ended",
};

/** "Ends in 12 days", "Ends today", "Ended 3 days ago". */
export function coverDaysText(state: CoverState, daysLeft: number | null): string {
  if (daysLeft === null) return "";
  if (state === "ended") return daysLeft === -1 ? "Ended yesterday" : `Ended ${-daysLeft} days ago`;
  if (daysLeft === 0) return "Ends today";
  return daysLeft === 1 ? "Ends tomorrow" : `Ends in ${daysLeft} days`;
}
