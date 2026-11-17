"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckboxRow, FormMessage, SelectField, TextField } from "@/components/ui/field";
import { initials } from "@/lib/initials";
import { ALL_MODULES, MODULE_INFO, type AppModule } from "@/lib/modules";
import {
  inviteAdmin,
  removeLogo,
  setModules,
  setStatus,
  setSupportAccess,
  updateOrganization,
  uploadLogo,
  type ActionState,
} from "../actions";
import { CURRENCIES, LOCALES, TIME_ZONES } from "../options";

export type ConsoleClient = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  status: "active" | "suspended";
  locale: string;
  currency: string;
  timeZone: string;
  logoUrl: string | null;
  logoMarkUrl: string | null;
  memberCount: number;
  adminCount: number;
  modules: AppModule[];
  mySupportAccess: boolean;
};

const initial: ActionState = { error: null, success: null };

function Panel({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-card">{title}</h2>
        {description && <p className="text-small text-text-2">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Result({ state }: { state: ActionState }) {
  if (state.error) return <FormMessage tone="error">{state.error}</FormMessage>;
  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;
  return null;
}

// ───────────── Details ─────────────

export function DetailsPanel({ client }: { client: ConsoleClient }) {
  const [state, action, pending] = useActionState(updateOrganization.bind(null, client.id), initial);
  return (
    <Panel title="Details">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <TextField label="Name" name="name" required defaultValue={client.name} />
        <TextField label="Short name" name="short_name" required defaultValue={client.shortName} />
        <SelectField label="Time zone" name="time_zone" defaultValue={client.timeZone} options={withCurrent(TIME_ZONES, client.timeZone)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Currency" name="currency" defaultValue={client.currency} options={withCurrent(CURRENCIES, client.currency)} />
          <SelectField label="Language and formats" name="locale" defaultValue={client.locale} options={withCurrent(LOCALES, client.locale)} />
        </div>
        <Result state={state} />
        <div>
          <Button type="submit" loading={pending}>Save details</Button>
        </div>
      </form>
    </Panel>
  );
}

/** Keeps a value set earlier selectable even if it isn't in today's list. */
function withCurrent(options: readonly { value: string; label: string }[], current: string) {
  return options.some((o) => o.value === current) ? options : [...options, { value: current, label: current }];
}

// ───────────── Modules ─────────────

export function ModulesPanel({ client }: { client: ConsoleClient }) {
  const [state, action, pending] = useActionState(setModules.bind(null, client.id), initial);
  return (
    <Panel
      title="Modules"
      description="Switched-off modules disappear from the client's menu, and the database refuses their data."
    >
      <form action={action} className="flex flex-col gap-4">
        <div className="grid gap-2">
          {ALL_MODULES.map((m) => (
            <CheckboxRow
              key={m}
              name="modules"
              value={m}
              title={MODULE_INFO[m].label}
              description={MODULE_INFO[m].description}
              defaultChecked={client.modules.includes(m)}
            />
          ))}
        </div>
        <Result state={state} />
        <div>
          <Button type="submit" loading={pending}>Save modules</Button>
        </div>
      </form>
    </Panel>
  );
}

// ───────────── Logos ─────────────

export function LogoPanel({ client }: { client: ConsoleClient }) {
  return (
    <Panel
      title="Logo"
      description="Shown on the sign-in page, at the top of the sidebar, and on printed reports and QR sheets. PNG, JPEG or WebP, up to 1 MB."
    >
      <LogoSlot client={client} kind="wide" label="Wide logo" current={client.logoUrl} />
      <LogoSlot client={client} kind="mark" label="Square mark (for the narrow sidebar)" current={client.logoMarkUrl} />
    </Panel>
  );
}

function LogoSlot({
  client,
  kind,
  label,
  current,
}: {
  client: ConsoleClient;
  kind: "wide" | "mark";
  label: string;
  current: string | null;
}) {
  const [state, action, pending] = useActionState(uploadLogo.bind(null, client.id, kind), initial);
  const [removeState, setRemoveState] = useState<ActionState>(initial);
  const [removing, startRemove] = useTransition();
  const inputId = `logo-${kind}`;

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-[200px] items-center justify-center rounded-sm border border-dashed border-border bg-sunken p-2">
          {current ? (
            // eslint-disable-next-line @next/next/no-img-element -- client logos live in Supabase Storage
            <img src={current} alt={`${client.name} ${label.toLowerCase()}`} className="max-h-10 max-w-full object-contain" />
          ) : (
            <span className="flex items-center gap-2 text-xs text-text-3">
              <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-sm bg-text text-[12.5px] font-semibold text-surface">
                {initials(client.name)}
              </span>
              No logo: initials show
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          {label} file
        </label>
        <input
          id={inputId}
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="max-w-full text-small file:mr-3 file:h-8 file:cursor-pointer file:rounded-sm file:border file:border-border-strong file:bg-surface file:px-3 file:text-[13px] file:font-medium hover:file:bg-sunken"
        />
        <Button type="submit" variant="secondary" loading={pending}>Upload</Button>
        {current && (
          <Button
            type="button"
            variant="ghost"
            loading={removing}
            onClick={() => startRemove(async () => setRemoveState(await removeLogo(client.id, kind)))}
          >
            Remove
          </Button>
        )}
      </div>
      <Result state={state.error || state.success ? state : removeState} />
    </form>
  );
}

// ───────────── Admins ─────────────

export function AdminsPanel({ client }: { client: ConsoleClient }) {
  const [state, action, pending] = useActionState(inviteAdmin.bind(null, client.id, client.slug), initial);
  return (
    <Panel
      title="Admins"
      description={
        <>
          {client.memberCount} {client.memberCount === 1 ? "person" : "people"}, {client.adminCount}{" "}
          {client.adminCount === 1 ? "Admin" : "Admins"}. The client&apos;s Admins invite everyone else from their own
          portal.
        </>
      }
    >
      <form action={action} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Invite an Admin"
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@client.edu"
          help="If they already have an AssetNXG account they get access straight away; otherwise they get an invite email."
        />
        <Result state={state} />
        <div>
          <Button type="submit" loading={pending}>Invite</Button>
        </div>
      </form>
    </Panel>
  );
}

// ───────────── Support access ─────────────

export function SupportPanel({ client }: { client: ConsoleClient }) {
  const [state, setState] = useState<ActionState>(initial);
  const [pending, start] = useTransition();
  const on = client.mySupportAccess;

  return (
    <Panel
      title="Support access"
      description="To help this client, you join it as an Admin. You stay hidden from its people lists, and the client's Admins can see the access in their audit log. Turn it off when you're done."
    >
      <p className="text-small">
        {on ? (
          <>
            You have support access. Open their portal at{" "}
            <span className="id">{client.slug}.assetnxg.app</span>.
          </>
        ) : (
          "You don't have access to this client's data."
        )}
      </p>
      <Result state={state} />
      <div>
        <Button
          variant={on ? "secondary" : "default"}
          loading={pending}
          onClick={() => start(async () => setState(await setSupportAccess(client.id, !on)))}
        >
          {on ? "Remove my support access" : "Turn on support access"}
        </Button>
      </div>
    </Panel>
  );
}

// ───────────── Pause / resume ─────────────

export function StatusPanel({ client }: { client: ConsoleClient }) {
  const [state, setState] = useState<ActionState>(initial);
  const [pending, start] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const paused = client.status === "suspended";

  function change(next: "active" | "suspended") {
    start(async () => {
      setState(await setStatus(client.id, next));
      setConfirmOpen(false);
    });
  }

  return (
    <Panel
      title={paused ? "Paused" : "Pause this client"}
      description={
        paused
          ? "Its people can't open any data until you resume. Nothing is deleted."
          : "Its people can't open any data until you resume it. Nothing is deleted."
      }
    >
      <Result state={state} />
      <div>
        {paused ? (
          <Button loading={pending} onClick={() => change("active")}>Resume client</Button>
        ) : (
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>Pause client</Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-card">Pause {client.name}?</DialogTitle>
            <DialogDescription>
              Everyone at {client.shortName} loses access until you resume. Their data stays as it is.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {/* Cancel left, action right (canvas rule). */}
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={pending} onClick={() => change("suspended")}>
              Pause client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
