import { describe, expect, it } from "vitest";
import { createItemsFor } from "./create-config";

const labels = (modules: Parameters<typeof createItemsFor>[0]) =>
  createItemsFor(modules).map((i) => i.label);

describe("createItemsFor", () => {
  it("a client with no modules can still create assets", () => {
    expect(labels([])).toEqual(["Asset"]);
  });

  it("housekeeping alone gives work orders and requests, not PM", () => {
    expect(labels(["housekeeping"])).toEqual(["Work order", "Service request", "Asset"]);
  });

  it("every module gives the whole canvas menu, in order", () => {
    expect(
      labels(["maintenance", "inspections", "reservations", "spares", "outside_repairs"]),
    ).toEqual([
      "Work order",
      "Service request",
      "PM schedule",
      "Inspection",
      "Reservation",
      "Asset",
      "Spare",
      "Send for outside repair",
    ]);
  });
});
