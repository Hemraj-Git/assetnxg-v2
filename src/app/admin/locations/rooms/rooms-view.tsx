"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, DoorOpen, Eye, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DetailDrawer,
  DrawerBody,
  DrawerFacts,
  DrawerFooter,
  DrawerHeader,
  DrawerSection,
} from "@/components/ui/detail-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CheckboxRow, FormMessage, SelectField, TextField, inputClass } from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { formatArea } from "@/lib/locations";
import type { TableParams } from "@/lib/table-params";
import { deleteLocation, saveRoom } from "../actions";
import type { RoomRow } from "../data";
import { ROOMS_TABLE, ROOM_STATUS_LABEL } from "./rooms-table";

type Option = { value: string; label: string };

function Status({ room }: { room: RoomRow }) {
  return room.status === "available" ? (
    <StatusChip tone="success" icon={CircleCheck}>
      {ROOM_STATUS_LABEL.available}
    </StatusChip>
  ) : (
    <StatusChip tone="warning" icon={Wrench}>
      {ROOM_STATUS_LABEL.under_maintenance}
    </StatusChip>
  );
}

export function RoomsView({
  rows,
  total,
  params,
  everyone,
  building,
  buildings,
  roomTypes,
  showReservable,
  timeZone,
}: {
  rows: RoomRow[];
  total: number;
  params: TableParams;
  /** Rooms in the organisation before any search or filter. */
  everyone: number;
  /** The building filter, if any. */
  building: string | null;
  buildings: Option[];
  roomTypes: Option[];
  /** The client has room bookings (Reservations module). */
  showReservable: boolean;
  timeZone: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ room: RoomRow | null } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const index = rows.findIndex((r) => r.id === openId);
  const open = index >= 0 ? rows[index] : null;
  const deleting = rows.find((r) => r.id === deleteId) ?? null;

  function setBuilding(value: string) {
    const next = new URLSearchParams(window.location.search);
    if (value) next.set("building", value);
    else next.delete("building");
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.replace(`${window.location.pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  const columns: ColumnDef<RoomRow, unknown>[] = [
    {
      id: "code",
      header: "Number",
      meta: { priority: 0, sticky: true },
      cell: ({ row }) => <span className="id">{row.original.code}</span>,
    },
    {
      id: "name",
      header: "Name",
      meta: { priority: 0 },
      cell: ({ row }) => <span className="block max-w-[260px] truncate font-medium">{row.original.name}</span>,
    },
    {
      id: "place",
      header: "Building · campus",
      meta: { priority: 1, label: "Building and campus" },
      cell: ({ row }) => <span className="block max-w-[260px] truncate text-text-2">{row.original.place}</span>,
    },
    {
      id: "type",
      header: "Type",
      meta: { priority: 2 },
      cell: ({ row }) => <span className="text-text-2">{row.original.roomType ?? "—"}</span>,
    },
    {
      id: "floor",
      header: "Floor",
      meta: { priority: 3 },
      cell: ({ row }) => <span className="text-text-2">{row.original.floor ?? "—"}</span>,
    },
    {
      id: "status",
      header: "Status",
      meta: { priority: 1 },
      cell: ({ row }) => <Status room={row.original} />,
    },
  ];

  const empty =
    everyone === 0 ? (
      <TableMessage
        icon={DoorOpen}
        actions={
          buildings.length > 0 ? (
            <Button onClick={() => setEditing({ room: null })}>
              <Plus aria-hidden /> Add room
            </Button>
          ) : undefined
        }
      >
        {buildings.length > 0
          ? "No rooms yet. Add the rooms and areas where assets are kept or work is done."
          : "Add a campus and a building first (on Campuses & buildings), then their rooms."}
      </TableMessage>
    ) : undefined;

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <DataTable
        id="rooms"
        noun={{ one: "room", many: "rooms" }}
        columns={columns}
        rows={rows}
        total={total}
        getRowId={(r) => r.id}
        params={params}
        defaults={ROOMS_TABLE}
        searchPlaceholder="Search by number, name, building or type"
        openRowId={openId}
        onOpenRow={(r) => setOpenId((cur) => (cur === r.id ? null : r.id))}
        empty={empty}
        toolbar={
          <>
            <label className="sr-only" htmlFor="rooms-building">
              Building
            </label>
            <select
              id="rooms-building"
              value={building ?? ""}
              onChange={(e) => setBuilding(e.target.value)}
              className={`${inputClass} h-8 w-auto max-w-56 cursor-pointer pr-8 text-[13px]`}
            >
              <option value="">All buildings</option>
              {buildings.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            {buildings.length > 0 && (
              <Button onClick={() => setEditing({ room: null })}>
                <Plus aria-hidden /> Add room
              </Button>
            )}
          </>
        }
        rowMenu={(r) => (
          <>
            <DropdownMenuItem onSelect={() => setOpenId(r.id)}>
              <Eye aria-hidden /> Open details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditing({ room: r })}>
              <Pencil aria-hidden /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteId(r.id)}>
              <Trash2 aria-hidden /> Delete…
            </DropdownMenuItem>
          </>
        )}
        renderCard={(r) => (
          <span className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1">
            <span className="id text-text-3">{r.code}</span>
            <Status room={r} />
            <span className="col-span-2 text-sm font-medium">{r.name}</span>
            <span className="col-span-2 truncate text-small text-text-2">
              {r.place}
              {r.roomType ? ` · ${r.roomType}` : ""}
            </span>
          </span>
        )}
      />

      <DetailDrawer open={open !== null} onOpenChange={(o) => !o && setOpenId(null)} width={480}>
        {open && (
          <>
            <DrawerHeader
              id={open.code}
              title={open.name}
              chips={<Status room={open} />}
              actions={
                <>
                  <Button onClick={() => setEditing({ room: open })}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setDeleteId(open.id)}>
                    <Trash2 aria-hidden /> Delete
                  </Button>
                </>
              }
            />
            <DrawerBody>
              <DrawerSection title="Room">
                <DrawerFacts
                  items={[
                    { label: "Building · campus", value: open.place },
                    { label: "Type", value: open.roomType ?? "—" },
                    { label: "Floor", value: open.floor ?? "—" },
                    { label: "Area", value: formatArea(open.areaSqft) || "—" },
                    ...(showReservable
                      ? [{ label: "Can be booked", value: open.isReservable ? "Yes" : "No" }]
                      : []),
                    { label: "Added", value: formatDate(open.createdAt, timeZone) },
                  ]}
                />
              </DrawerSection>
              <DrawerSection title="Coming with later modules">
                <p className="text-small text-text-2">
                  The room&apos;s assets, QR label, bookings and check-in log appear here as those modules are built.
                </p>
              </DrawerSection>
            </DrawerBody>
            <DrawerFooter
              position={`${index + 1} of ${rows.length} on this page`}
              onPrevious={index > 0 ? () => setOpenId(rows[index - 1].id) : undefined}
              onNext={index < rows.length - 1 ? () => setOpenId(rows[index + 1].id) : undefined}
            />
          </>
        )}
      </DetailDrawer>

      {editing && (
        <RoomDialog
          key={editing.room?.id ?? "new"}
          room={editing.room}
          defaultBuilding={building}
          buildings={buildings}
          roomTypes={roomTypes}
          showReservable={showReservable}
          onClose={() => setEditing(null)}
          onDone={(message) => {
            setEditing(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title={`Delete ${deleting?.name ?? "this room"}?`}
        description="This can't be undone. Rooms that have assets, bookings or jobs can't be deleted once those modules are in use."
        confirmLabel="Delete room"
        typeToConfirm={deleting?.code}
        pending={busy}
        onConfirm={() => {
          const id = deleteId;
          if (!id) return;
          startTransition(async () => {
            const result = await deleteLocation("room", id);
            setNotice(result);
            setDeleteId(null);
            if (!result.error && openId === id) setOpenId(null);
          });
        }}
      />
    </>
  );
}

function RoomDialog({
  room,
  defaultBuilding,
  buildings,
  roomTypes,
  showReservable,
  onClose,
  onDone,
}: {
  room: RoomRow | null;
  defaultBuilding: string | null;
  buildings: Option[];
  roomTypes: Option[];
  showReservable: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveRoom(room?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  const buildingValue = room?.buildingId ?? defaultBuilding ?? (buildings.length === 1 ? buildings[0].value : "");

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{room ? `Edit ${room.name}` : "Add room"}</DialogTitle>
            <DialogDescription>
              {room ? room.code : "A room or an area (corridor, lawn, plant room). The number (ROM-…) is given when you save."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Name" name="name" required maxLength={80} defaultValue={room?.name ?? ""} placeholder="e.g. Classroom 204" />
            <SelectField
              label="Building"
              name="building_id"
              defaultValue={buildingValue}
              options={[...(buildingValue ? [] : [{ value: "", label: "Choose a building" }]), ...buildings]}
              help={room ? "Changing the building moves the room; its number stays." : undefined}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Type"
                name="room_type_id"
                defaultValue={room?.roomTypeId ?? ""}
                options={[{ value: "", label: "No type" }, ...roomTypes]}
              />
              <TextField label="Floor" name="floor" optional maxLength={30} defaultValue={room?.floor ?? ""} placeholder="e.g. Ground, 2" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Area"
                name="area_sqft"
                optional
                inputMode="decimal"
                suffix="sq ft"
                defaultValue={room?.areaSqft ?? ""}
              />
              <SelectField
                label="Status"
                name="status"
                defaultValue={room?.status ?? "available"}
                options={[
                  { value: "available", label: "Available" },
                  { value: "under_maintenance", label: "Under maintenance" },
                ]}
              />
            </div>
            {showReservable && (
              <CheckboxRow
                name="is_reservable"
                value="on"
                title="Can be booked"
                description="Staff can reserve this room by the hour."
                defaultChecked={room?.isReservable ?? true}
              />
            )}
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {room ? "Save" : "Add room"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
