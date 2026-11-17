import type { ComponentProps, ReactNode } from "react";
import { cn } from "cn";

// Canvas · Controls: 36px fields, border-strong (3.7:1 for WCAG 1.4.11),
// 6px radius, focus = primary border + 3px soft ring, error = danger.
// Labels 13/18 medium; help 12/16 text-3; errors 12/16 danger, never colour alone.

export const inputClass = [
  "h-9 w-full min-w-0 rounded-sm border border-border-strong bg-surface px-2.5 text-body text-text outline-none",
  "transition-[border-color,box-shadow] duration-(--dur-1) hover:border-text-2",
  "focus:border-primary focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_22%,transparent)]",
  "aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-danger)_14%,transparent)]",
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:text-text-3",
].join(" ");

type FieldShell = {
  label: string;
  name: string;
  help?: ReactNode;
  error?: string | null;
  optional?: boolean;
  className?: string;
};

function Shell({
  label,
  name,
  help,
  error,
  optional,
  className,
  children,
}: FieldShell & { children: (ids: { describedBy?: string }) => ReactNode }) {
  const helpId = help ? `${name}-help` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [errorId, helpId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={name} className="flex items-baseline gap-1.5 text-[13px] leading-[18px] font-medium text-text">
        {label}
        {optional && <span className="text-xs font-normal text-text-3">(optional)</span>}
      </label>
      {children({ describedBy })}
      {error && (
        <p id={errorId} className="text-xs leading-4 font-medium text-danger dark:text-danger-ink">
          {error}
        </p>
      )}
      {help && !error && (
        <p id={helpId} className="text-xs leading-4 text-text-3">
          {help}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  help,
  error,
  optional,
  className,
  suffix,
  ...input
}: FieldShell & ComponentProps<"input"> & { suffix?: ReactNode }) {
  return (
    <Shell label={label} name={name} help={help} error={error} optional={optional} className={className}>
      {({ describedBy }) =>
        suffix ? (
          <div className="flex items-stretch">
            <input
              id={name}
              name={name}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy}
              className={cn(inputClass, "rounded-r-none")}
              {...input}
            />
            <span className="flex items-center rounded-r-sm border border-l-0 border-border-strong bg-sunken px-2.5 text-cell whitespace-nowrap text-text-2">
              {suffix}
            </span>
          </div>
        ) : (
          <input
            id={name}
            name={name}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={inputClass}
            {...input}
          />
        )
      }
    </Shell>
  );
}

export function SelectField({
  label,
  name,
  help,
  error,
  optional,
  className,
  options,
  ...select
}: FieldShell & ComponentProps<"select"> & { options: readonly { value: string; label: string }[] }) {
  return (
    <Shell label={label} name={name} help={help} error={error} optional={optional} className={className}>
      {({ describedBy }) => (
        <select
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(inputClass, "cursor-pointer pr-8")}
          {...select}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Shell>
  );
}

/** Checkbox with a title and a line of explanation (module lists). */
export function CheckboxRow({
  name,
  value,
  title,
  description,
  defaultChecked,
}: {
  name: string;
  value: string;
  title: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-sm border border-border bg-surface px-3 py-2.5 hover:bg-sunken has-checked:border-primary has-checked:bg-primary-weak"
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 flex-none cursor-pointer accent-(--color-primary)"
      />
      <span className="flex min-w-0 flex-col">
        <span className="text-[13.5px] font-medium">{title}</span>
        {description && <span className="text-xs leading-4 text-text-3">{description}</span>}
      </span>
    </label>
  );
}

/** Form-level message under a form or at the top of a panel. */
export function FormMessage({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-sm border px-3 py-2 text-small",
        tone === "error"
          ? "border-danger/40 bg-danger-tint text-danger-ink"
          : "border-success/40 bg-success-tint text-success-ink",
      )}
    >
      {children}
    </p>
  );
}
