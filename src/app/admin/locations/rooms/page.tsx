import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { buildingOptions } from "@/lib/locations";
import { moduleEnabled } from "@/lib/modules";
import { applyTableParams, parseTableParams } from "@/lib/table-params";
import { loadLocations } from "../data";
import { LocationsTabs } from "../locations-tabs";
import { ROOMS_TABLE, buildingFilter, roomSearchText, roomSortValue } from "./rooms-table";
import { RoomsView } from "./rooms-view";

export const metadata: Metadata = { title: "Rooms" };

// Rooms and areas: list, search, filter by building, add, edit, delete.
export default async function RoomsPage({ searchParams }: PageProps<"/admin/locations/rooms">) {
  const { ctx, supabase } = await requireAdmin();
  const data = await loadLocations(supabase, ctx.brand.id);

  const query = await searchParams;
  const building = buildingFilter(query.building, new Set(data.buildings.map((b) => b.id)));
  const scoped = building ? data.rooms.filter((r) => r.buildingId === building) : data.rooms;

  const params = parseTableParams(query, ROOMS_TABLE);
  const result = applyTableParams(scoped, params, { searchText: roomSearchText, sortValue: roomSortValue });

  return (
    <PageBody>
      <PageHeader title="Locations" description="Where everything is: campus, then building or block, then room or area." />
      <LocationsTabs active="rooms" data={data} />
      <RoomsView
        rows={result.rows}
        total={result.total}
        params={{ ...params, page: result.page }}
        everyone={data.rooms.length}
        building={building}
        buildings={buildingOptions(data.campuses, data.buildings)}
        roomTypes={data.roomTypes.map((t) => ({ value: t.id, label: t.name }))}
        showReservable={moduleEnabled("reservations", ctx.modules)}
        timeZone={ctx.timeZone}
      />
    </PageBody>
  );
}
