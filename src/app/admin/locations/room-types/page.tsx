import type { Metadata } from "next";
import { PageBody, PageHeader } from "@/components/shell/page-header";
import { requireAdmin } from "@/lib/auth";
import { loadLocations } from "../data";
import { LocationsTabs } from "../locations-tabs";
import { RoomTypesView } from "./room-types-view";

export const metadata: Metadata = { title: "Room types" };

// One room-type list per client, kept in the database (07 lesson 8).
export default async function RoomTypesPage() {
  const { ctx, supabase } = await requireAdmin();
  const data = await loadLocations(supabase, ctx.brand.id);

  return (
    <PageBody>
      <PageHeader title="Locations" description="Where everything is: campus, then building or block, then room or area." />
      <LocationsTabs active="room-types" data={data} />
      <RoomTypesView types={data.roomTypes} />
    </PageBody>
  );
}
