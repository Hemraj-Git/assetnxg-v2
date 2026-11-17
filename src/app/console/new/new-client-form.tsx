"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { CheckboxRow, FormMessage, SelectField, TextField } from "@/components/ui/field";
import { ALL_MODULES, MODULE_INFO } from "@/lib/modules";
import { createOrganization, type ActionState } from "../actions";
import { CURRENCIES, LOCALES, TIME_ZONES } from "../options";

const initial: ActionState = { error: null, success: null };

export function NewClientForm() {
  const [state, action, pending] = useActionState(createOrganization, initial);

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-6" noValidate>
      {state.error && <FormMessage tone="error">{state.error}</FormMessage>}

      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <h2 className="text-card">Client</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <TextField label="Name" name="name" required placeholder="School of Maritime Studies" />
          <TextField label="Short name" name="short_name" required placeholder="SoMS" help="Shown where space is tight." />
        </div>
        <TextField
          label="Portal address"
          name="slug"
          required
          placeholder="soms"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          pattern="[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?"
          suffix=".assetnxg.app"
          help="Lower-case letters, digits and hyphens. It can't be changed later."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Time zone" name="time_zone" defaultValue="Asia/Kolkata" options={TIME_ZONES} />
          <SelectField label="Currency" name="currency" defaultValue="INR" options={CURRENCIES} />
          <SelectField label="Language and formats" name="locale" defaultValue="en-IN" options={LOCALES} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-card">Modules</h2>
          <p className="text-small text-text-2">
            Always included: dashboard, locations, categories, assets, documents, vendors, people, QR codes and reports.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_MODULES.map((m) => (
            <CheckboxRow
              key={m}
              name="modules"
              value={m}
              title={MODULE_INFO[m].label}
              description={MODULE_INFO[m].description}
              defaultChecked
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-md border border-border bg-surface p-6">
        <h2 className="text-card">First Admin</h2>
        <TextField
          label="Email"
          name="admin_email"
          type="email"
          optional
          autoComplete="off"
          help="We email an invite to set a password. If they already have an AssetNXG account, they get access straight away."
        />
      </section>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={pending}>
          Create client
        </Button>
      </div>
    </form>
  );
}
