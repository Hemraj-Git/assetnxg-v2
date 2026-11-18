import { CalendarClock, CircleCheck, Clock, PauseCircle, RefreshCw, XCircle, type LucideIcon } from "lucide-react";
import { StatusChip, type ChipTone } from "@/components/ui/status-chip";
import { CONTRACT_STATE_LABEL, coverDaysText, type ContractState } from "@/lib/contracts";

const STYLE: Record<ContractState, { tone: ChipTone; icon: LucideIcon }> = {
  upcoming: { tone: "info", icon: Clock },
  active: { tone: "success", icon: CircleCheck },
  ends_soon: { tone: "warning", icon: CalendarClock },
  ended: { tone: "danger", icon: XCircle },
  renewed: { tone: "neutral", icon: RefreshCw },
  not_renewing: { tone: "neutral", icon: PauseCircle },
};

export function ContractStateChip({ state, className }: { state: ContractState; className?: string }) {
  const s = STYLE[state];
  return (
    <StatusChip tone={s.tone} icon={s.icon} className={className}>
      {CONTRACT_STATE_LABEL[state]}
    </StatusChip>
  );
}

/** "Ends in 12 days" for active / ending / ended contracts; "" otherwise. */
export function contractDaysText(state: ContractState, daysLeft: number | null): string {
  if (state === "active" || state === "ends_soon" || state === "ended") return coverDaysText(state, daysLeft);
  return "";
}
