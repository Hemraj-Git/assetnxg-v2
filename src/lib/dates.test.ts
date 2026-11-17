import { describe, expect, it } from "vitest";
import { formatDate, formatTime, previousIsoDate, todayIso, yearInZone } from "./dates";

// 18:30 UTC is midnight IST (UTC+05:30).
const UTC_DEC_31_18_29 = new Date("2026-12-31T18:29:59Z"); // 23:59:59 IST, 31 Dec
const UTC_DEC_31_18_30 = new Date("2026-12-31T18:30:00Z"); // 00:00 IST, 1 Jan 2027
const UTC_EARLY_MORNING = new Date("2026-11-16T20:00:00Z"); // 01:30 IST, 17 Nov

describe("todayIso", () => {
  it("gives the IST date, not the UTC date, after IST midnight", () => {
    // UTC still says 16 Nov; India is already on 17 Nov.
    expect(UTC_EARLY_MORNING.toISOString().slice(0, 10)).toBe("2026-11-16");
    expect(todayIso("Asia/Kolkata", UTC_EARLY_MORNING)).toBe("2026-11-17");
  });

  it("switches day exactly at IST midnight", () => {
    expect(todayIso("Asia/Kolkata", UTC_DEC_31_18_29)).toBe("2026-12-31");
    expect(todayIso("Asia/Kolkata", UTC_DEC_31_18_30)).toBe("2027-01-01");
  });

  it("defaults to Asia/Kolkata", () => {
    expect(todayIso(undefined, UTC_EARLY_MORNING)).toBe("2026-11-17");
  });

  it("respects another organisation time zone", () => {
    expect(todayIso("UTC", UTC_EARLY_MORNING)).toBe("2026-11-16");
  });
});

describe("yearInZone", () => {
  it("uses the IST year for numbers on New Year's Eve after 18:30 UTC", () => {
    expect(yearInZone("Asia/Kolkata", UTC_DEC_31_18_29)).toBe(2026);
    expect(yearInZone("Asia/Kolkata", UTC_DEC_31_18_30)).toBe(2027);
  });
});

describe("formatDate", () => {
  it("shows a database date as DD-MM-YYYY without shifting it", () => {
    expect(formatDate("2026-11-17")).toBe("17-11-2026");
    expect(formatDate("2026-01-01", "America/Los_Angeles")).toBe("01-01-2026");
  });

  it("shows an instant as its IST calendar date", () => {
    expect(formatDate("2026-12-31T18:30:00Z")).toBe("01-01-2027");
    expect(formatDate(UTC_EARLY_MORNING)).toBe("17-11-2026");
  });

  it("leaves empty values empty", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });

  it("refuses garbage instead of printing 'Invalid Date'", () => {
    expect(() => formatDate("not a date")).toThrow(/Not a date/);
  });
});

describe("formatTime", () => {
  it("shows the IST clock time in 24-hour HH:mm", () => {
    expect(formatTime(UTC_EARLY_MORNING)).toBe("01:30");
    expect(formatTime("2026-11-17T09:12:00Z")).toBe("14:42");
  });

  it("is empty for empty values and refuses junk", () => {
    expect(formatTime(null)).toBe("");
    expect(() => formatTime("nope")).toThrow();
  });
});

describe("previousIsoDate", () => {
  it("steps back across month and year ends", () => {
    expect(previousIsoDate("2026-11-17")).toBe("2026-11-16");
    expect(previousIsoDate("2026-03-01")).toBe("2026-02-28");
    expect(previousIsoDate("2027-01-01")).toBe("2026-12-31");
  });
});
