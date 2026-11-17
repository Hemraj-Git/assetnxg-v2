import { describe, expect, it } from "vitest";
import {
  filterNotifications,
  groupByDay,
  notificationHref,
  unreadBadge,
  type NotificationItem,
} from "./notifications";

function item(over: Partial<NotificationItem>): NotificationItem {
  return {
    id: over.id ?? "n",
    type: "due_today",
    title: "t",
    body: null,
    refTable: null,
    refId: null,
    refNumber: null,
    read: false,
    createdAt: "2026-11-17T04:00:00Z",
    ...over,
  };
}

describe("filterNotifications", () => {
  const items = [
    item({ id: "a", type: "wo_assigned", read: true }),
    item({ id: "b", type: "inspection_assigned" }),
    item({ id: "c", type: "request_escalated" }),
  ];

  it("all keeps everything", () => {
    expect(filterNotifications(items, "all").map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("unread keeps the unread ones", () => {
    expect(filterNotifications(items, "unread").map((n) => n.id)).toEqual(["b", "c"]);
  });

  it("assigned keeps work given to you, read or not", () => {
    expect(filterNotifications(items, "assigned").map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("notificationHref", () => {
  it("opens the record on its page", () => {
    expect(notificationHref("work_orders", "abc")).toBe("/admin/work-orders?open=abc");
    expect(notificationHref("rooms", "r1")).toBe("/admin/locations?open=r1");
  });

  it("opens the page when there is no record id", () => {
    expect(notificationHref("service_requests", null)).toBe("/admin/service-requests");
  });

  it("points nowhere for unknown or missing tables", () => {
    expect(notificationHref(null, "x")).toBeNull();
    expect(notificationHref("secret_table", "x")).toBeNull();
  });
});

describe("groupByDay", () => {
  // 17 Nov 2026, 10:00 IST.
  const now = new Date("2026-11-17T04:30:00Z");

  it("groups by the IST day: Today, Yesterday, then the date", () => {
    const groups = groupByDay(
      [
        item({ id: "today", createdAt: "2026-11-17T03:00:00Z" }), // 08:30 IST, 17th
        item({ id: "early", createdAt: "2026-11-16T19:00:00Z" }), // 00:30 IST, 17th (UTC says 16th)
        item({ id: "yday", createdAt: "2026-11-16T10:00:00Z" }), // 15:30 IST, 16th
        item({ id: "older", createdAt: "2026-11-10T10:00:00Z" }),
      ],
      "Asia/Kolkata",
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((n) => n.id)])).toEqual([
      ["Today", ["today", "early"]],
      ["Yesterday", ["yday"]],
      ["10-11-2026", ["older"]],
    ]);
  });

  it("gives nothing for no items", () => {
    expect(groupByDay([], "Asia/Kolkata", now)).toEqual([]);
  });
});

describe("unreadBadge", () => {
  it("hides at zero and caps at 99+", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(4)).toBe("4");
    expect(unreadBadge(120)).toBe("99+");
  });
});
