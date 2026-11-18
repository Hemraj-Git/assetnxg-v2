import {
  CONTRACT_KINDS,
  CONTRACT_STATE_LABEL,
  KIND_LABEL,
  type ContractKind,
  type ContractState,
} from "@/lib/contracts";
import type { TableDefaults } from "@/lib/table-params";

// The Warranty & AMC list: rows, search, sort and filters. Shared by the
// server page and the table.

export type ContractRow = {
  id: string;
  code: string;
  kind: ContractKind;
  vendorId: string | null;
  vendorName: string | null;
  contractNo: string | null;
  startsOn: string;
  endsOn: string;
  cost: number | null;
  visitsPerYear: number | null;
  coverage: string | null;
  assetIds: string[];
  /** "AST-0013 Split AC 2 Ton" for each covered asset, in number order. */
  assets: { id: string; code: string; name: string }[];
  renewedFromId: string | null;
  renewedFromCode: string | null;
  /** The contract that renewed this one, if any. */
  renewedById: string | null;
  renewedByCode: string | null;
  notRenewing: boolean;
  state: ContractState;
  daysLeft: number | null;
};

export const CONTRACTS_TABLE: TableDefaults = {
  sortable: ["code", "kind", "vendor", "ends", "assets", "state"],
  sort: "ends",
  dir: "asc",
};

const STATE_ORDER: Record<ContractState, number> = {
  ended: 0,
  ends_soon: 1,
  active: 2,
  upcoming: 3,
  not_renewing: 4,
  renewed: 5,
};

export function contractSearchText(c: ContractRow): string {
  return [
    c.code,
    KIND_LABEL[c.kind],
    c.vendorName ?? "",
    c.contractNo ?? "",
    c.coverage ?? "",
    ...c.assets.map((a) => `${a.code} ${a.name}`),
  ].join(" ");
}

export function contractSortValue(c: ContractRow, column: string): string | number | null {
  switch (column) {
    case "code":
      return c.code;
    case "kind":
      return KIND_LABEL[c.kind];
    case "vendor":
      return c.vendorName;
    case "ends":
      return c.endsOn;
    case "assets":
      return c.assetIds.length;
    case "state":
      return STATE_ORDER[c.state];
    default:
      return null;
  }
}

export type ContractFilters = { kind: ContractKind | null; state: "attention" | ContractState | null };

export function parseContractFilters(query: Record<string, string | string[] | undefined>): ContractFilters {
  const k = query.kind;
  const s = query.state;
  return {
    kind: typeof k === "string" && (CONTRACT_KINDS as readonly string[]).includes(k) ? (k as ContractKind) : null,
    state:
      typeof s === "string" && (s === "attention" || s in CONTRACT_STATE_LABEL) ? (s as ContractFilters["state"]) : null,
  };
}

export function applyContractFilters(rows: readonly ContractRow[], f: ContractFilters): ContractRow[] {
  return rows.filter(
    (c) =>
      (!f.kind || c.kind === f.kind) &&
      (!f.state ||
        (f.state === "attention" ? c.state === "ends_soon" || c.state === "ended" : c.state === f.state)),
  );
}
