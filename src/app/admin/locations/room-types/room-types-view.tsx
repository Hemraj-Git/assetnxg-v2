"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { TableMessage } from "@/components/data-table/table-message";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage, TextField } from "@/components/ui/field";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { formatCount } from "@/lib/table-params";
import { deleteLocation, saveRoomType } from "../actions";
import type { RoomTypeRow } from "../data";

export function RoomTypesView({ types }: { types: RoomTypeRow[] }) {
  const [renaming, setRenaming] = useState<RoomTypeRow | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [busy, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [addState, add, adding] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveRoomType(null, prev, formData);
    if (result.success) {
      formRef.current?.reset();
      setNotice(result);
    }
    return result;
  }, initialActionState);

  return (
    <>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      <form ref={formRef} action={add} noValidate className="flex max-w-xl flex-wrap items-end gap-2">
        <TextField
          label="New room type"
          name="name"
          maxLength={60}
          placeholder="e.g. Simulator room"
          className="min-w-56 flex-1"
          error={addState.error}
        />
        <Button type="submit" loading={adding}>
          <Plus aria-hidden /> Add
        </Button>
      </form>

      <div className="max-w-xl overflow-hidden rounded-md border border-border bg-surface">
        {types.length === 0 ? (
          <TableMessage icon={Tag}>No room types. Add the kinds of rooms your organisation has.</TableMessage>
        ) : (
          <ul>
            {types.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-b border-border px-4 py-2 last:border-b-0">
                <span className="flex-1 truncate text-cell font-medium">{t.name}</span>
                <span className="text-small text-text-3 tabular-nums">
                  {t.rooms === 0 ? "Not used" : `${formatCount(t.rooms)} ${t.rooms === 1 ? "room" : "rooms"}`}
                </span>
                <Button variant="ghost" size="icon-sm" aria-label={`Rename ${t.name}`} onClick={() => setRenaming(t)}>
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t.rooms > 0 ? `${t.name} is in use and can't be removed` : `Remove ${t.name}`}
                  title={t.rooms > 0 ? "In use: give those rooms another type first" : undefined}
                  disabled={busy || t.rooms > 0}
                  onClick={() =>
                    startTransition(async () => {
                      setNotice(await deleteLocation("roomType", t.id));
                    })
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="max-w-xl text-small text-text-3">
        A type that rooms use can&apos;t be removed; change those rooms on the{" "}
        <Link href="/admin/locations/rooms">Rooms</Link> tab first. Names ignore capitals: “Classroom” and
        “classroom” are the same type.
      </p>

      {renaming && (
        <RenameDialog
          key={renaming.id}
          type={renaming}
          onClose={() => setRenaming(null)}
          onDone={(message) => {
            setRenaming(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}
    </>
  );
}

function RenameDialog({
  type,
  onClose,
  onDone,
}: {
  type: RoomTypeRow;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await saveRoomType(type.id, prev, formData);
    if (result.success) onDone(`Renamed to ${String(formData.get("name") ?? "").trim()}.`);
    return result;
  }, initialActionState);

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="sm">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">Rename {type.name}</DialogTitle>
            <DialogDescription>
              {type.rooms > 0 ? `The ${formatCount(type.rooms)} rooms of this type show the new name.` : "Not used by any room yet."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Name" name="name" required maxLength={60} defaultValue={type.name} />
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
