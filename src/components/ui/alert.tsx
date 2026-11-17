import type { ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "cn";

// Canvas · Feedback › alerts: tint + ink + icon + words, 6px radius, 13.5/20.

const STYLES = {
  info: { cls: "bg-info-tint text-info-ink border-info/30", Icon: Info },
  warning: { cls: "bg-warning-tint text-warning-ink border-warning/30", Icon: TriangleAlert },
  danger: { cls: "bg-danger-tint text-danger-ink border-danger/30", Icon: CircleAlert },
  success: { cls: "bg-success-tint text-success-ink border-success/30", Icon: CircleCheck },
} as const;

export function Alert({
  tone,
  title,
  children,
  id,
}: {
  tone: keyof typeof STYLES;
  title?: string;
  children?: ReactNode;
  id?: string;
}) {
  const { cls, Icon } = STYLES[tone];
  return (
    <div
      id={id}
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-2.5 rounded-sm border px-3.5 py-3 text-[13.5px] leading-5", cls)}
    >
      <Icon aria-hidden className="mt-0.5 size-4 flex-none" />
      <div>
        {title && <span className="font-semibold">{title}</span>}
        {title && children ? " " : null}
        {children}
      </div>
    </div>
  );
}
