"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowLeftRight, MonitorUp, Pencil, Trash2 } from "lucide-react";
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
import { FormMessage, SelectField, TextField } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { initialActionState, type ActionState } from "@/lib/form-actions";
import { cn } from "cn";
import { deleteSpare, deploySpare, recordStock } from "../actions";

type Place = { buildings: { id: string; name: string }[]; rooms: { id: string; code: string; name: string; buildingId: string }[] };

export function SparePageActions({
  spare,
  places,
  today,
  hasHistory,
}: {
  spare: { id: string; code: string; name: string; quantity: number; serialNo: string | null };
  places: Place;
  /** ISO date in the client's time zone. */
  today: string;
  hasHistory: boolean;
}) {
  const [open, setOpen] = useState<"stock" | "deploy" | "delete" | null>(null);
  const [notice, setNotice] = useState<ActionState>(initialActionState);
  const [deleting, startDelete] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen("stock")}>
          <ArrowLeftRight aria-hidden /> Adjust stock
        </Button>
        <Button
          variant="secondary"
          disabled={spare.quantity < 1}
          title={spare.quantity < 1 ? "None in stock to deploy" : undefined}
          onClick={() => setOpen("deploy")}
        >
          <MonitorUp aria-hidden /> Deploy as asset
        </Button>
        <Button variant="secondary" asChild>
          <Link href={`/admin/spares/${spare.code}/edit`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
        {!hasHistory && (
          <Button variant="ghost" onClick={() => setOpen("delete")}>
            <Trash2 aria-hidden /> Delete
          </Button>
        )}
      </div>
      {(notice.error || notice.success) && (
        <FormMessage tone={notice.error ? "error" : "success"}>{notice.error ?? notice.success}</FormMessage>
      )}

      {open === "stock" && (
        <StockDialog
          spare={spare}
          onClose={() => setOpen(null)}
          onDone={(message) => {
            setOpen(null);
            setNotice({ error: null, success: message });
          }}
        />
      )}
      {open === "deploy" && <DeployDialog spare={spare} places={places} today={today} onClose={() => setOpen(null)} />}

      <ConfirmDialog
        open={open === "delete"}
        onOpenChange={(o) => !o && setOpen(null)}
        title={`Delete ${spare.code}?`}
        description="Only for a spare added by mistake. Its opening stock and links to documents go too. This can't be undone."
        confirmLabel="Delete spare"
        typeToConfirm={spare.code}
        pending={deleting}
        onConfirm={() =>
          startDelete(async () => {
            const result = await deleteSpare(spare.id);
            setOpen(null);
            setNotice(result);
          })
        }
      />
    </div>
  );
}

const STOCK_CHOICES = [
  { value: "received", title: "Received", hint: "Add to stock" },
  { value: "issued", title: "Taken out", hint: "Used or issued" },
  { value: "adjusted", title: "Count corrected", hint: "Set to what you counted" },
] as const;

function StockDialog({
  spare,
  onClose,
  onDone,
}: {
  spare: { id: string; code: string; name: string; quantity: number };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [choice, setChoice] = useState<(typeof STOCK_CHOICES)[number]["value"]>("received");
  const [state, action, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await recordStock(spare.id, prev, formData);
    if (result.success) onDone(result.success);
    return result;
  }, initialActionState);

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">Adjust stock · {spare.code}</DialogTitle>
            <DialogDescription>
              {spare.name} · {spare.quantity.toLocaleString("en-IN")} in stock now. Every change is kept in the stock history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <fieldset className="grid gap-2 sm:grid-cols-3">
              <legend className="mb-1.5 text-[13px] leading-[18px] font-medium">What happened</legend>
              {STOCK_CHOICES.map((c) => (
                <label
                  key={c.value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-sm border border-border px-3 py-2 hover:bg-sunken",
                    choice === c.value && "border-primary bg-primary-weak",
                  )}
                >
                  <input
                    type="radio"
                    name="action"
                    value={c.value}
                    checked={choice === c.value}
                    onChange={() => setChoice(c.value)}
                    className="sr-only"
                  />
                  <span className="text-[13.5px] font-medium">{c.title}</span>
                  <span className="text-xs text-text-3">{c.hint}</span>
                </label>
              ))}
            </fieldset>
            <TextField
              key={choice}
              label={choice === "adjusted" ? "Quantity counted" : choice === "received" ? "How many received" : "How many taken out"}
              name="quantity"
              inputMode="numeric"
              autoFocus
              className="sm:max-w-[220px]"
            />
            <TextField
              label="Note"
              name="note"
              optional
              maxLength={200}
              placeholder={choice === "received" ? "e.g. Invoice 4471" : choice === "issued" ? "e.g. AC repair, Block B" : "e.g. Monthly count"}
            />
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

function DeployDialog({
  spare,
  places,
  today,
  onClose,
}: {
  spare: { id: string; code: string; name: string; quantity: number; serialNo: string | null };
  places: Place;
  today: string;
  onClose: () => void;
}) {
  const [buildingId, setBuildingId] = useState("");
  const rooms = places.rooms.filter((r) => r.buildingId === buildingId);
  const [state, action, pending] = useActionState(
    async (prev: ActionState, formData: FormData) => deploySpare(spare.id, prev, formData),
    initialActionState,
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent size="md">
        <form action={action} noValidate className="contents">
          <DialogHeader>
            <DialogTitle className="text-card">Deploy as asset · {spare.code}</DialogTitle>
            <DialogDescription>
              {`Makes a new asset with this spare's details, specifications and documents, and takes 1 from stock (${spare.quantity.toLocaleString("en-IN")} → ${(spare.quantity - 1).toLocaleString("en-IN")}). A warranty still running is added to the asset.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <TextField label="Asset name" name="name" maxLength={120} defaultValue={spare.name} />
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Building or block"
                name="building_id"
                value={buildingId}
                onChange={(e) => setBuildingId(e.target.value)}
                options={[{ value: "", label: "Choose…" }, ...places.buildings.map((b) => ({ value: b.id, label: b.name }))]}
              />
              <SelectField
                key={buildingId}
                label="Room or area"
                name="room_id"
                disabled={!buildingId}
                options={[{ value: "", label: buildingId ? "Choose…" : "Choose a building first" }, ...rooms.map((r) => ({ value: r.id, label: `${r.name} · ${r.code}` }))]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Serial number"
                name="serial_no"
                optional
                maxLength={80}
                defaultValue={spare.quantity === 1 ? (spare.serialNo ?? "") : ""}
                help="Of this unit."
              />
              <TextField
                label="Installation date"
                name="installation_date"
                placeholder="DD-MM-YYYY"
                inputMode="numeric"
                defaultValue={formatDate(today)}
                help="Locked once saved."
              />
            </div>
            {state.error && <FormMessage tone="error">{state.error}</FormMessage>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Deploy
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
