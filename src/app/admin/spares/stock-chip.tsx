import { CircleCheck, PackageX, TriangleAlert } from "lucide-react";
import { StatusChip, type ChipTone } from "@/components/ui/status-chip";
import { STOCK_STATE_LABEL, type StockState } from "@/lib/spares";

const LOOK: Record<StockState, { tone: ChipTone; icon: typeof CircleCheck }> = {
  out: { tone: "danger", icon: PackageX },
  low: { tone: "warning", icon: TriangleAlert },
  ok: { tone: "success", icon: CircleCheck },
};

export function StockChip({ state, className }: { state: StockState; className?: string }) {
  return (
    <StatusChip tone={LOOK[state].tone} icon={LOOK[state].icon} className={className}>
      {STOCK_STATE_LABEL[state]}
    </StatusChip>
  );
}
