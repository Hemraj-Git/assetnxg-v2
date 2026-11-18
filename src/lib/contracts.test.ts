import { describe, expect, it } from "vitest";
import { contractGroup, contractState, coverDaysText, coverState, currentCover, needsVendor } from "./contracts";

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
});

describe("contractState", () => {
  const c = (endsOn: string, flags: { renewed?: boolean; notRenewing?: boolean } = {}) => ({
    startsOn: "2026-01-01",
    endsOn,
    renewed: flags.renewed ?? false,
    notRenewing: flags.notRenewing ?? false,
  });

  it("stops flagging an ending contract once it is renewed or won't be", () => {
    expect(contractState(c("2026-12-01"), today).state).toBe("ends_soon");
    expect(contractState(c("2026-12-01", { renewed: true }), today).state).toBe("renewed");
    expect(contractState(c("2026-11-01", { notRenewing: true }), today).state).toBe("not_renewing");
  });

  it("keeps an active contract active whatever the flags", () => {
    expect(contractState(c("2027-06-01", { notRenewing: true }), today).state).toBe("active");
  });
});

describe("groups and vendors", () => {
  it("puts AMCs together and warranties together", () => {
    expect(contractGroup("camc")).toBe("maintenance");
    expect(contractGroup("extended_warranty")).toBe("warranty");
    expect(needsVendor("amc")).toBe(true);
    expect(needsVendor("warranty")).toBe(false);
  });
});

describe("currentCover", () => {
  const k = (id: string, kind: "amc" | "warranty" | "extended_warranty", startsOn: string, endsOn: string) => ({ id, kind, startsOn, endsOn });

  it("prefers the contract in force, then the next, then the last ended, per group", () => {
    const cover = currentCover(
      [
        k("w-old", "warranty", "2024-03-12", "2026-03-11"),
        k("ext", "extended_warranty", "2026-03-12", "2028-03-11"),
        k("amc-old", "amc", "2025-04-01", "2026-03-31"),
        k("amc-next", "amc", "2027-04-01", "2028-03-31"),
      ],
      today,
    );
    expect(cover.warranty?.id).toBe("ext");
    expect(cover.maintenance?.id).toBe("amc-next");
  });

  it("falls back to the last one that ended", () => {
    const cover = currentCover([k("a", "amc", "2024-04-01", "2025-03-31"), k("b", "amc", "2025-04-01", "2026-03-31")], today);
    expect(cover.maintenance?.id).toBe("b");
    expect(cover.warranty).toBeUndefined();
  });
});

describe("coverDaysText", () => {
  it("says it in plain words", () => {
    expect(coverDaysText("ends_soon", 0)).toBe("Ends today");
    expect(coverDaysText("active", 133)).toBe("Ends in 133 days");
    expect(coverDaysText("ended", -3)).toBe("Ended 3 days ago");
  });
});
