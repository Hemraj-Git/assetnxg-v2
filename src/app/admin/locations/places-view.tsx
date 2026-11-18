"use client";

import Link from "next/link";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { CornerDownRight, DoorOpen, MapPin, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import type { BuildingNode, CampusNode, PlaceRow } from "@/lib/locations";
import { formatCount } from "@/lib/table-params";
import { deleteLocation, saveBuilding, saveCampus } from "./actions";

type Editing =
  | { kind: "campus"; campus: CampusNode | null }
  | { kind: "building"; building: BuildingNode | null; campusId: string | null }
  | null;

type Deleting = { kind: "campus" | "building"; id: string; code: string; name: string; blocked: boolean } | null;

export function PlacesView({ rows, campuses }: { rows: PlaceRow[]; campuses: CampusNode[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<Deleting>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();

  const done = (message: string) => {
    setEditing(null);
    setNotice({ error: null, success: message });
  };

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {campuses.length > 0 && (
          <Button variant="secondary" onClick={() => setEditing({ kind: "building", building: null, campusId: null })}>
            <Plus aria-hidden /> Add building
          </Button>
        )}
        <Button onClick={() => setEditing({ kind: "campus", campus: null })}>
          <Plus aria-hidden /> Add campus
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-surface">
        {rows.length === 0 ? (
          <TableMessage
            icon={MapPin}
            actions={
              <Button onClick={() => setEditing({ kind: "campus", campus: null })}>
                <Plus aria-hidden /> Add campus
              </Button>
            }
          >
            No locations yet. Start with a campus, then add its buildings and rooms.
          </TableMessage>
        ) : (
          <table className="w-full min-w-[640px] border-separate border-spacing-0 text-cell">
            <thead>
              <tr>
                <th scope="col" className="border-b border-border px-4 py-2.5 text-left text-[12.5px] font-medium text-text-2">
                  Campus / building
                </th>
                <th scope="col" className="border-b border-border px-4 py-2.5 text-right text-[12.5px] font-medium text-text-2">
                  Buildings
                </th>
                <th scope="col" className="border-b border-border px-4 py-2.5 text-right text-[12.5px] font-medium text-text-2">
                  Rooms
                </th>
                <th scope="col" className="w-12 border-b border-border">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) =>
                row.kind === "campus" ? (
                  <tr key={row.campus.id} className="bg-sunken/50 hover:bg-sunken">
                    <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-normal">
                      <span className="flex items-start gap-2">
                        <MapPin aria-hidden className="mt-0.5 size-4 flex-none text-text-3" />
                        <span className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={() => setEditing({ kind: "campus", campus: row.campus })}
                            className="w-fit text-left font-semibold hover:underline"
                          >
                            {row.campus.name}
                          </button>
                          <span className="text-small text-text-3">
                            <span className="id">{row.campus.code}</span>
                            {row.campus.address ? ` · ${row.campus.address}` : ""}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="border-b border-border px-4 py-2.5 text-right tabular-nums">{formatCount(row.buildings)}</td>
                    <td className="border-b border-border px-4 py-2.5 text-right tabular-nums">{formatCount(row.rooms)}</td>
                    <td className="border-b border-border px-2 py-1.5 text-right">
                      <RowMenu label={row.campus.name}>
                        <DropdownMenuItem onSelect={() => setEditing({ kind: "campus", campus: row.campus })}>
                          <Pencil aria-hidden /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => setEditing({ kind: "building", building: null, campusId: row.campus.id })}
                        >
                          <Plus aria-hidden /> Add a building here
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            setDeleting({
                              kind: "campus",
                              id: row.campus.id,
                              code: row.campus.code,
                              name: row.campus.name,
                              blocked: row.buildings > 0,
                            })
                          }
                        >
                          <Trash2 aria-hidden /> Delete…
                        </DropdownMenuItem>
                      </RowMenu>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.building.id} className="hover:bg-sunken">
                    <th scope="row" className="border-b border-border px-4 py-2.5 text-left font-normal">
                      <span className="flex items-start gap-2 pl-6">
                        <CornerDownRight aria-hidden className="mt-0.5 size-4 flex-none text-text-3" />
                        <span className="flex min-w-0 flex-col">
                          <button
                            type="button"
                            onClick={() => setEditing({ kind: "building", building: row.building, campusId: row.campus.id })}
                            className="w-fit text-left font-medium hover:underline"
                          >
                            {row.building.name}
                          </button>
                          <span className="text-small text-text-3">
                            <span className="id">{row.building.code}</span>
                            {row.building.totalFloors !== null
                              ? ` · ${row.building.totalFloors} ${row.building.totalFloors === 1 ? "floor" : "floors"}`
                              : ""}
                          </span>
                        </span>
                      </span>
                    </th>
                    <td className="border-b border-border px-4 py-2.5 text-right text-text-3">—</td>
                    <td className="border-b border-border px-4 py-2.5 text-right tabular-nums">
                      {row.rooms > 0 ? (
                        <Link href={`/admin/locations/rooms?building=${row.building.id}`}>{formatCount(row.rooms)}</Link>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="border-b border-border px-2 py-1.5 text-right">
                      <RowMenu label={row.building.name}>
                        <DropdownMenuItem
                          onSelect={() => setEditing({ kind: "building", building: row.building, campusId: row.campus.id })}
                        >
                          <Pencil aria-hidden /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/admin/locations/rooms?building=${row.building.id}`}>
                            <DoorOpen aria-hidden /> Rooms in this building
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            setDeleting({
                              kind: "building",
                              id: row.building.id,
                              code: row.building.code,
                              name: row.building.name,
                              blocked: row.rooms > 0,
                            })
                          }
                        >
                          <Trash2 aria-hidden /> Delete…
                        </DropdownMenuItem>
                      </RowMenu>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing?.kind === "campus" && (
        <CampusDialog key={editing.campus?.id ?? "new"} campus={editing.campus} onClose={() => setEditing(null)} onDone={done} />
      )}
      {editing?.kind === "building" && (
        <BuildingDialog
          key={`${editing.building?.id ?? "new"}-${editing.campusId ?? ""}`}
          building={editing.building}
          campusId={editing.campusId}
          campuses={campuses}
          onClose={() => setEditing(null)}
          onDone={done}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description={
          deleting?.blocked
            ? deleting.kind === "campus"
              ? "It still has buildings. Move or delete them first, or the delete is refused."
              : "It still has rooms. Move or delete them first, or the delete is refused."
            : "This can't be undone."
        }
        confirmLabel={deleting?.kind === "campus" ? "Delete campus" : "Delete building"}
        typeToConfirm={deleting?.code}
        pending={busy}
        onConfirm={() => {
          const target = deleting;
          if (!target) return;
          startTransition(async () => {
            setNotice(await deleteLocation(target.kind, target.id));
            setDeleting(null);
          });
        }}
      />
    </>
  );
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}

function CampusDialog({
  campus,
  onClose,
  onDone,
}: {
  campus: CampusNode | null;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveCampus(campus?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="sm">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{campus ? `Edit ${campus.name}` : "Add campus"}</DialogTitle>
            <DialogDescription>{campus ? campus.code : "The number (CAM-…) is given when you save."}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Name" name="name" required maxLength={80} defaultValue={campus?.name ?? ""} />
            <TextField label="Address" name="address" optional maxLength={300} defaultValue={campus?.address ?? ""} />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {campus ? "Save" : "Add campus"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function BuildingDialog({
  building,
  campusId,
  campuses,
  onClose,
  onDone,
}: {
  building: BuildingNode | null;
  campusId: string | null;
  campuses: CampusNode[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveBuilding(building?.id ?? null, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  const sorted = [...campuses].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const defaultCampus = building?.campusId ?? campusId ?? (sorted.length === 1 ? sorted[0].id : "");

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="sm">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">{building ? `Edit ${building.name}` : "Add building"}</DialogTitle>
            <DialogDescription>
              {building ? building.code : "A building or block. The number (BLD-…) is given when you save."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Name" name="name" required maxLength={80} defaultValue={building?.name ?? ""} />
            <SelectField
              label="Campus"
              name="campus_id"
              defaultValue={defaultCampus}
              options={[
                ...(defaultCampus ? [] : [{ value: "", label: "Choose a campus" }]),
                ...sorted.map((c) => ({ value: c.id, label: c.name })),
              ]}
              help={building ? "Changing the campus moves the building and its rooms." : undefined}
            />
            <TextField
              label="Floors"
              name="total_floors"
              optional
              inputMode="numeric"
              defaultValue={building?.totalFloors ?? ""}
              className="max-w-40"
            />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {building ? "Save" : "Add building"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
