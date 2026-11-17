"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import {
  Bell,
  CheckCheck,
  CircleCheck,
  ClipboardCheck,
  Clock,
  LogOut,
  OctagonAlert,
  Truck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTime } from "@/lib/dates";
import {
  dismissNotification,
  markAllNotificationsRead,
  markNotificationsRead,
} from "@/lib/notification-actions";
import {
  filterNotifications,
  groupByDay,
  notificationHref,
  unreadBadge,
  type NotificationFilter,
  type NotificationItem,
  type NotificationType,
} from "@/lib/notifications";
import { createRealtimeClient } from "@/lib/supabase/client";
import { playChime, unlockAudio, useSoundPreference } from "./use-sound";

// Canvas · Header menus › Notifications (Radix Popover, 380 wide).
// The list comes from the server (layout); Realtime tells us when it changed
// and the page refreshes. Mark read / dismiss show at once (useOptimistic) and
// the Server Action refreshes with the real state.

export type BellProps = {
  userId: string;
  orgId: string;
  timeZone: string;
  items: NotificationItem[];
  unread: number;
};

const LOOK: Record<NotificationType, { icon: LucideIcon; tone: string }> = {
  wo_assigned: { icon: Wrench, tone: "text-primary-ink" },
  inspection_assigned: { icon: ClipboardCheck, tone: "text-inspection" },
  auto_checkout: { icon: LogOut, tone: "text-text-2" },
  vendor_handover: { icon: Truck, tone: "text-warning" },
  outside_repair_sent: { icon: Truck, tone: "text-text-2" },
  outside_repair_overdue: { icon: Truck, tone: "text-danger" },
  request_resolved: { icon: CircleCheck, tone: "text-success" },
  request_escalated: { icon: OctagonAlert, tone: "text-danger" },
  request_closed: { icon: CircleCheck, tone: "text-text-2" },
  due_today: { icon: Clock, tone: "text-warning" },
};

const FILTERS: { value: NotificationFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "assigned", label: "Assigned to me" },
];

const EMPTY: Record<NotificationFilter, string> = {
  all: "No notifications. New work and updates will show here.",
  unread: "You're all caught up.",
  assigned: "Nothing has been assigned to you.",
};

type Bell = { items: NotificationItem[]; unread: number };
type Change = { kind: "read"; ids: string[] } | { kind: "read-all" } | { kind: "dismiss"; id: string };

function applyChange(state: Bell, change: Change): Bell {
  if (change.kind === "read-all") {
    return { items: state.items.map((n) => ({ ...n, read: true })), unread: 0 };
  }
  if (change.kind === "read") {
    const hits = state.items.filter((n) => !n.read && change.ids.includes(n.id)).length;
    return {
      items: state.items.map((n) => (change.ids.includes(n.id) ? { ...n, read: true } : n)),
      unread: Math.max(0, state.unread - hits),
    };
  }
  const gone = state.items.find((n) => n.id === change.id);
  return {
    items: state.items.filter((n) => n.id !== change.id),
    unread: Math.max(0, state.unread - (gone && !gone.read ? 1 : 0)),
  };
}

export function NotificationBell({ userId, orgId, timeZone, items, unread }: BellProps) {
  const router = useRouter();
  const [bell, change] = useOptimistic<Bell, Change>({ items, unread }, applyChange);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [soundOn] = useSoundPreference();
  const soundRef = useRef(soundOn);

  useEffect(() => {
    soundRef.current = soundOn;
    if (!soundOn) return;
    // Sound can only start after a tap or key press (browser rule).
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [soundOn]);

  // Live updates: any change to this person's notifications refreshes the
  // page data. Rows for their other clients are ignored here (and the server
  // only ever lists this client's).
  useEffect(() => {
    const supabase = createRealtimeClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase
      .channel(`bell:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { organization_id?: string } | null;
          if (row?.organization_id && row.organization_id !== orgId) return;
          if (payload.eventType === "INSERT" && soundRef.current) playChime();
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 250);
        },
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [userId, orgId, router]);

  function run(c: Change, action: () => Promise<void>) {
    startTransition(async () => {
      change(c);
      await action();
    });
  }

  const badge = unreadBadge(bell.unread);
  const shown = filterNotifications(bell.items, filter);
  const groups = now ? groupByDay(shown, timeZone, now) : [];
  const unreadInList = bell.items.filter((n) => !n.read).length;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setNow(new Date());
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={badge ? `Notifications, ${bell.unread} unread` : "Notifications"}
        >
          <Bell aria-hidden className="size-5" />
          {badge && (
            <span
              aria-hidden
              className="absolute top-0 left-[17px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] leading-none font-bold text-white tabular-nums dark:bg-[#C93A3A]"
            >
              {badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <span role="status" className="sr-only">
        {badge ? `${bell.unread} unread notifications` : ""}
      </span>

      <PopoverContent
        align="end"
        sideOffset={6}
        aria-label="Notifications"
        className="w-[380px] max-w-[calc(100vw-1rem)]"
      >
        <div className="flex items-center justify-between gap-2 pt-3 pr-3 pb-2 pl-4">
          <h2 className="text-card">Notifications</h2>
          <Button
            variant="ghost"
            size="sm"
            disabled={bell.unread === 0}
            onClick={() => run({ kind: "read-all" }, markAllNotificationsRead)}
          >
            <CheckCheck aria-hidden />
            Mark all read
          </Button>
        </div>

        <div className="px-4 pb-2">
          <div
            role="group"
            aria-label="Show"
            className="inline-flex gap-0.5 rounded-sm border border-border bg-sunken p-0.5"
          >
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-xs px-2.5 text-[13px] text-text-2",
                  filter === f.value && "bg-surface font-medium text-text shadow-1 dark:bg-raised",
                )}
              >
                {f.label}
                {f.value === "unread" && unreadInList > 0 && (
                  <span className="inline-flex h-[18px] min-w-5 items-center justify-center rounded-full bg-primary-weak px-1.5 text-[11.5px] leading-none font-semibold text-primary-ink tabular-nums">
                    {unreadInList}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[min(480px,65vh)] overflow-y-auto">
          {groups.length === 0 ? (
            <p className="border-t border-border px-4 py-8 text-center text-small text-text-2">
              {EMPTY[filter]}
            </p>
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h3 className="border-t border-border px-4 pt-2 pb-1 text-[11.5px] font-semibold tracking-[.03em] text-text-3 uppercase">
                  {group.label}
                </h3>
                <ul>
                  {group.items.map((n) => (
                    <Row
                      key={n.id}
                      item={n}
                      timeZone={timeZone}
                      onOpen={() => {
                        setOpen(false);
                        if (!n.read) run({ kind: "read", ids: [n.id] }, () => markNotificationsRead([n.id]));
                      }}
                      onMarkRead={() => run({ kind: "read", ids: [n.id] }, () => markNotificationsRead([n.id]))}
                      onDismiss={() => run({ kind: "dismiss", id: n.id }, () => dismissNotification(n.id))}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Row({
  item,
  timeZone,
  onOpen,
  onMarkRead,
  onDismiss,
}: {
  item: NotificationItem;
  timeZone: string;
  onOpen: () => void;
  onMarkRead: () => void;
  onDismiss: () => void;
}) {
  const { icon: Icon, tone } = LOOK[item.type];
  const href = notificationHref(item.refTable, item.refId);
  const titleClass = cn(
    "text-left text-[13.5px] leading-[19px] text-text no-underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus",
    item.read ? "font-normal" : "font-semibold",
  );

  return (
    <li
      className={cn(
        "group relative grid grid-cols-[28px_1fr_auto] gap-2.5 border-t border-border px-4 py-2.5 hover:bg-row-hover",
        !item.read && "bg-primary-weak hover:bg-primary-weak",
      )}
    >
      <span
        aria-hidden
        className={cn("flex size-7 items-center justify-center rounded-full border border-border bg-surface", tone)}
      >
        <Icon className="size-3.5" />
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        {href ? (
          <Link href={href} onClick={onOpen} className={titleClass}>
            {item.title}
          </Link>
        ) : item.read ? (
          <span className="text-[13.5px] leading-[19px]">{item.title}</span>
        ) : (
          <button type="button" onClick={onMarkRead} className={titleClass}>
            {item.title}
          </button>
        )}
        {item.body && <span className="line-clamp-2 text-small text-text-2">{item.body}</span>}
        <span className="text-xs text-text-3 tabular-nums">
          {item.refNumber && (
            <>
              <span className="id text-[11.5px]">{item.refNumber}</span> ·{" "}
            </>
          )}
          {formatTime(item.createdAt, timeZone)}
          {!item.read && <span className="sr-only">, unread</span>}
        </span>
      </div>

      <div className="relative z-10 flex flex-col items-end gap-1">
        <span
          aria-hidden
          className={cn("mt-1.5 size-2 rounded-full", item.read ? "bg-transparent" : "bg-primary")}
        />
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Dismiss: ${item.title}`}
          onClick={onDismiss}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
        >
          <X aria-hidden />
        </Button>
      </div>
    </li>
  );
}
