import type { Database } from "@/lib/supabase/database.types";
import { formatDate, previousIsoDate, todayIso } from "./dates";

// The header bell's rules, kept free of React and Supabase so they are
// unit-tested. Rows come from public.notifications (server-inserted only,
// docs/context/03-business-rules.md §12).

export type NotificationType = Database["public"]["Enums"]["notification_type"];

export type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  refTable: string | null;
  refId: string | null;
  refNumber: string | null;
  read: boolean;
  createdAt: string;
};

export type NotificationFilter = "all" | "unread" | "assigned";

/** Work given to this person (canvas filter "Assigned to me"). */
const ASSIGNMENT_TYPES: readonly NotificationType[] = ["wo_assigned", "inspection_assigned"];

export function filterNotifications(
  items: readonly NotificationItem[],
  filter: NotificationFilter,
): NotificationItem[] {
  if (filter === "unread") return items.filter((n) => !n.read);
  if (filter === "assigned") return items.filter((n) => ASSIGNMENT_TYPES.includes(n.type));
  return [...items];
}

// Where each kind of record lives in the admin app. A record id goes in
// `?open=` for the drawer that its page gains in its phase.
const ROUTES: Record<string, string> = {
  work_orders: "/admin/work-orders",
  service_requests: "/admin/service-requests",
  inspections: "/admin/inspections",
  outside_repairs: "/admin/outside-repairs",
  reservations: "/admin/reservations",
  assets: "/admin/assets",
  rooms: "/admin/locations",
};

/** The page a notification opens, or null when it points nowhere we know. */
export function notificationHref(refTable: string | null, refId: string | null): string | null {
  if (!refTable) return null;
  const base = ROUTES[refTable];
  if (!base) return null;
  return refId ? `${base}?open=${encodeURIComponent(refId)}` : base;
}

export type DayGroup = { key: string; label: string; items: NotificationItem[] };

/**
 * Newest-first items grouped by calendar day in the client's time zone:
 * "Today", "Yesterday", then DD-MM-YYYY. Order inside a group is kept.
 */
export function groupByDay(
  items: readonly NotificationItem[],
  timeZone: string,
  now: Date = new Date(),
): DayGroup[] {
  const today = todayIso(timeZone, now);
  const yesterday = previousIsoDate(today);
  const groups: DayGroup[] = [];

  for (const item of items) {
    const day = todayIso(timeZone, new Date(item.createdAt));
    let group = groups.find((g) => g.key === day);
    if (!group) {
      const label =
        day === today ? "Today" : day === yesterday ? "Yesterday" : formatDate(day);
      group = { key: day, label, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/** Badge text: the count, capped so the pip stays small. */
export function unreadBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}
