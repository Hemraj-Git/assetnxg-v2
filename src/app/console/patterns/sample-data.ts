import type { TableDefaults } from "@/lib/table-params";

// Made-up sample rows for the patterns preview only (the canvas's examples).
// Never shown to clients; real lists read their own organisation's data.

export type SampleAsset = {
  id: string;
  name: string;
  category: string;
  location: string;
  status: "Operational" | "Under maintenance" | "In storage" | "Retired";
  lastService: string | null; // ISO date
  nextPm: string | null; // ISO date
  cost: number;
};

export const ASSET_TABLE: TableDefaults = {
  sortable: ["id", "name", "status", "location", "nextPm", "cost"],
  sort: "id",
  dir: "asc",
};

const BASE: Omit<SampleAsset, "id">[] = [
  { name: "DG set 125 kVA", category: "Power › Generator", location: "Utility yard · Main campus", status: "Operational", lastService: "2026-09-04", nextPm: "2026-10-04", cost: 1240000 },
  { name: "Split AC 2 Ton", category: "HVAC › Split AC", location: "Bridge Simulator Room · Block A", status: "Operational", lastService: "2026-10-02", nextPm: "2026-11-02", cost: 48500 },
  { name: "Split AC 1.5 Ton", category: "HVAC › Split AC", location: "Bridge Sim Debrief Room · Block B", status: "Operational", lastService: "2026-10-02", nextPm: "2026-11-02", cost: 39900 },
  { name: "Split AC 1.5 Ton", category: "HVAC › Split AC", location: "Classroom 204 · Block B", status: "Under maintenance", lastService: "2026-09-18", nextPm: null, cost: 39900 },
  { name: "Exhaust fan 18 in", category: "HVAC › Ventilation", location: "Chemistry Lab · Block C", status: "Operational", lastService: "2026-07-11", nextPm: "2027-01-11", cost: 6800 },
  { name: "Overhead projector", category: "AV › Projector", location: "Store room · Block A", status: "Retired", lastService: null, nextPm: null, cost: 12000 },
  { name: "Passenger lift", category: "Lifts", location: "Lift lobby · Block B", status: "Operational", lastService: "2026-09-15", nextPm: "2026-10-15", cost: 1850000 },
  { name: "Projector, ceiling mount", category: "AV › Projector", location: "Lecture Hall 1 · Block A", status: "Under maintenance", lastService: "2026-08-12", nextPm: "2026-11-12", cost: 72000 },
  { name: "Engine room simulator", category: "Simulators", location: "Engine Simulator Room · Block C", status: "Operational", lastService: "2026-07-05", nextPm: "2026-10-08", cost: 18500000 },
  { name: "Fire pump 30 HP", category: "Pumps › Fire", location: "Pump House · Utility block", status: "Operational", lastService: "2026-09-24", nextPm: "2026-10-01", cost: 215000 },
  { name: "Water cooler 80 L", category: "Plumbing › Cooler", location: "Corridor · Block A", status: "In storage", lastService: "2026-06-01", nextPm: null, cost: 28500 },
];

/** 64 rows (enough for several pages): the base list repeated with new IDs. */
export const SAMPLE_ASSETS: SampleAsset[] = Array.from({ length: 64 }, (_, i) => {
  const base = BASE[i % BASE.length];
  return { ...base, id: `AST-${String(i * 3 + 5).padStart(4, "0")}` };
});

export function assetSearchText(a: SampleAsset): string {
  return `${a.id} ${a.name} ${a.category} ${a.location} ${a.status}`;
}

export function assetSortValue(a: SampleAsset, column: string): string | number | null {
  switch (column) {
    case "name":
      return a.name;
    case "status":
      return a.status;
    case "location":
      return a.location;
    case "nextPm":
      return a.nextPm;
    case "cost":
      return a.cost;
    default:
      return a.id;
  }
}

// Charts: work orders by type per week (last 8 weeks), requests, SLA,
// technician workload.
export const WORK_BY_WEEK = [
  { week: "07-09", preventive: 18, corrective: 9, housekeeping: 12, inspection: 4 },
  { week: "14-09", preventive: 21, corrective: 7, housekeeping: 11, inspection: 5 },
  { week: "21-09", preventive: 16, corrective: 12, housekeeping: 13, inspection: 3 },
  { week: "28-09", preventive: 24, corrective: 8, housekeeping: 10, inspection: 6 },
  { week: "05-10", preventive: 19, corrective: 11, housekeeping: 14, inspection: 4 },
  { week: "12-10", preventive: 22, corrective: 6, housekeeping: 12, inspection: 7 },
  { week: "19-10", preventive: 17, corrective: 10, housekeeping: 15, inspection: 5 },
  { week: "26-10", preventive: 25, corrective: 9, housekeeping: 13, inspection: 3 },
];

export const REQUESTS_BY_WEEK = [
  { week: "07-09", requests: 31 },
  { week: "14-09", requests: 28 },
  { week: "21-09", requests: 36 },
  { week: "28-09", requests: 33 },
  { week: "05-10", requests: 41 },
  { week: "12-10", requests: 38 },
  { week: "19-10", requests: 44 },
  { week: "26-10", requests: 39 },
];

export const WORKLOAD = [
  { person: "Ravi Kumar", open: 7 },
  { person: "Sunita Das", open: 5 },
  { person: "Arjun Mehta", open: 4 },
  { person: "Farah Khan", open: 3 },
  { person: "Joseph Thomas", open: 2 },
];
