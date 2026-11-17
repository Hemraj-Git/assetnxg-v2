import { cn } from "cn";
import { initials } from "@/lib/initials";

// Canvas · Feedback: 28px circle, primary-weak tint, 11.5px semibold initials.
export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full bg-primary-weak font-semibold tracking-[.02em] text-primary-ink",
        size === "sm" && "size-[22px] text-[10px]",
        size === "md" && "size-7 text-[11.5px]",
        size === "lg" && "size-9 text-[13px]",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
