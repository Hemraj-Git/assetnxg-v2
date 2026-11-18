import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { placeTree } from "@/lib/locations";
import { loadLocations } from "./data";
import { LocationsTabs } from "./locations-tabs";
import { PlacesView } from "./places-view";

export const metadata: Metadata = { title: "Locations" };

// Campuses and their buildings as a tree (02 "Organization"; tree view
// approved in 05).
export default async function LocationsPage() {
  const { ctx, supabase } = await requireAdmin();
  const data = await loadLocations(supabase, ctx.brand.id);

  const roomsPerBuilding = new Map<string, number>();
  for (const r of data.rooms) roomsPerBuilding.set(r.buildingId, (roomsPerBuilding.get(r.buildingId) ?? 0) + 1);

  return (
    <PageBody>
      <PageHeader
        title="Locations"
        description="Where everything is: campus, then building or block, then room or area."
      />
      <LocationsTabs active="places" data={data} />
      <PlacesView rows={placeTree(data.campuses, data.buildings, roomsPerBuilding)} campuses={data.campuses} />
    </PageBody>
  );
}
