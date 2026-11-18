import { daysBetween } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

// Warranty and AMC contracts that cover assets (owner, 18-11-2026; 06 §A).
// Dates are ISO calendar dates; "today" is the client's today (pass
// todayIso(timeZone)). The database checks the rules; these explain them.

export type ContractKind = Database["public"]["Enums"]["contract_kind"];

export const CONTRACT_KINDS: readonly ContractKind[] = ["amc", "camc", "warranty", "extended_warranty"];

export const KIND_LABEL: Record<ContractKind, string> = {
  amc: "AMC",
  camc: "Comprehensive AMC",
  warranty: "Warranty",
  extended_warranty: "Extended warranty",
};

/** Overlaps are checked within a group: an asset can have a warranty and an
 *  AMC at once, but not two AMCs. */
export type ContractGroup = "maintenance" | "warranty";

export function contractGroup(kind: ContractKind): ContractGroup {
  return kind === "amc" || kind === "camc" ? "maintenance" : "warranty";
}

/** An AMC needs a vendor; a warranty may be from the maker. */
export function needsVendor(kind: ContractKind): boolean {
  return contractGroup(kind) === "maintenance";
}

export type CoverState = "upcoming" | "active" | "ends_soon" | "ended";

/** Days before the end when a contract shows as "Ends soon". The Warranty &
 *  AMC module makes its reminder days a setting; this is the list's cue. */
export const ENDS_SOON_DAYS = 30;

export function coverState(
  period: { startsOn: string | null; endsOn: string | null },
  today: string,
): { state: CoverState; daysLeft: number | null } {
  if (period.startsOn && daysBetween(today, period.startsOn) > 0) {
    return { state: "upcoming", daysLeft: period.endsOn ? daysBetween(today, period.endsOn) : null };
  }
  if (!period.endsOn) return { state: "active", daysLeft: null };
  const daysLeft = daysBetween(today, period.endsOn);
  if (daysLeft < 0) return { state: "ended", daysLeft };
  if (daysLeft <= ENDS_SOON_DAYS) return { state: "ends_soon", daysLeft };
  return { state: "active", daysLeft };
}

export const COVER_LABEL: Record<CoverState, string> = {
  upcoming: "Starts later",
  active: "Active",
  ends_soon: "Ends soon",
  ended: "Ended",
};

/** "Ends in 12 days", "Ends today", "Ended 3 days ago". */
export function coverDaysText(state: CoverState, daysLeft: number | null): string {
  if (daysLeft === null) return "";
  if (state === "ended") return daysLeft === -1 ? "Ended yesterday" : `Ended ${-daysLeft} days ago`;
  if (daysLeft === 0) return "Ends today";
  return daysLeft === 1 ? "Ends tomorrow" : `Ends in ${daysLeft} days`;
}

export type ContractState = CoverState | "renewed" | "not_renewing";

export const CONTRACT_STATE_LABEL: Record<ContractState, string> = {
  ...COVER_LABEL,
  renewed: "Renewed",
  not_renewing: "Not renewing",
};

/**
 * A contract's state for lists: ending or ended contracts that were renewed,
 * or that won't be renewed, stop showing as needing attention.
 */
export function contractState(
  c: { startsOn: string; endsOn: string; notRenewing: boolean; renewed: boolean },
  today: string,
): { state: ContractState; daysLeft: number | null } {
  const base = coverState(c, today);
  const winding = base.state === "ends_soon" || base.state === "ended";
  if (winding && c.renewed) return { state: "renewed", daysLeft: base.daysLeft };
  if (winding && c.notRenewing) return { state: "not_renewing", daysLeft: base.daysLeft };
  return base;
}

/** True when the list should flag it: ending soon or ended, not handled. */
export function needsAttention(state: ContractState): boolean {
  return state === "ends_soon" || state === "ended";
}

/**
 * An asset's current cover per group: the contract in force today, else the
 * next one to start, else the one that ended last. Contracts are the asset's
 * own (any order).
 */
export function currentCover<T extends { kind: ContractKind; startsOn: string; endsOn: string }>(
  contracts: readonly T[],
  today: string,
): Partial<Record<ContractGroup, T>> {
  const out: Partial<Record<ContractGroup, T>> = {};
  for (const group of ["warranty", "maintenance"] as const) {
    const mine = contracts.filter((c) => contractGroup(c.kind) === group);
    const now = mine.find((c) => c.startsOn <= today && today <= c.endsOn);
    const next = mine.filter((c) => c.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0];
    const last = mine.filter((c) => c.endsOn < today).sort((a, b) => b.endsOn.localeCompare(a.endsOn))[0];
    const pick = now ?? next ?? last;
    if (pick) out[group] = pick;
  }
  return out;
}
