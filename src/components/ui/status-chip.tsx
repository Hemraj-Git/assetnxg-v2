import type { LucideIcon } from "lucide-react";
import { cn } from "cn";

// Canvas · Feedback: status = tint + ink + icon + word, never colour alone.
// 4px radius, 22px tall, 12.5px medium.

export type ChipTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONES: Record<ChipTone, string> = {
  success: "bg-success-tint text-success-ink",
  warning: "bg-warning-tint text-warning-ink",
  danger: "bg-danger-tint text-danger-ink",
  info: "bg-info-tint text-info-ink",
  neutral: "bg-neutral-tint text-neutral-ink",
};

export function StatusChip({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: ChipTone;
  icon: LucideIcon;
  children: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1 rounded-xs px-2 text-[12.5px] leading-none font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {children}
    </span>
  );
}
