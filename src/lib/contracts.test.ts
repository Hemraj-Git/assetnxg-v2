import { describe, expect, it } from "vitest";
import { coverDaysText, coverState } from "./contracts";

const today = "2026-11-18";
const period = (startsOn: string | null, endsOn: string | null) => ({ startsOn, endsOn });

describe("coverState", () => {
  it("is upcoming before the start date", () => {
    expect(coverState(period("2026-12-01", "2027-11-30"), today).state).toBe("upcoming");
  });

  it("is active, then ends soon within 30 days, then ended", () => {
    expect(coverState(period("2026-01-01", "2027-03-31"), today)).toEqual({ state: "active", daysLeft: 133 });
    expect(coverState(period("2026-01-01", "2026-12-18"), today)).toEqual({ state: "ends_soon", daysLeft: 30 });
    expect(coverState(period("2026-01-01", "2026-11-18"), today)).toEqual({ state: "ends_soon", daysLeft: 0 });
    expect(coverState(period("2026-01-01", "2026-11-15"), today)).toEqual({ state: "ended", daysLeft: -3 });
  });

  it("is active with no end date", () => {
    expect(coverState(period(null, null), today)).toEqual({ state: "active", daysLeft: null });
  });
});

describe("coverDaysText", () => {
  it("says it in plain words", () => {
    expect(coverDaysText("ends_soon", 0)).toBe("Ends today");
    expect(coverDaysText("ends_soon", 1)).toBe("Ends tomorrow");
    expect(coverDaysText("active", 133)).toBe("Ends in 133 days");
    expect(coverDaysText("ended", -1)).toBe("Ended yesterday");
    expect(coverDaysText("ended", -3)).toBe("Ended 3 days ago");
    expect(coverDaysText("active", null)).toBe("");
  });
});
