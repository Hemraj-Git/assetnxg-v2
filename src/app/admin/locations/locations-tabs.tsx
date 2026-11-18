import { SectionTabs } from "@/components/shell/section-tabs";
import type { Locations } from "./data";

export function LocationsTabs({
  active,
  data,
}: {
  active: "places" | "rooms" | "room-types";
  data: Locations;
}) {
  return (
    <SectionTabs
      label="Locations"
      active={active}
      tabs={[
        { key: "places", label: "Campuses & buildings", href: "/admin/locations", count: data.buildings.length },
        { key: "rooms", label: "Rooms", href: "/admin/locations/rooms", count: data.rooms.length },
        { key: "room-types", label: "Room types", href: "/admin/locations/room-types", count: data.roomTypes.length },
      ]}
    />
  );
}
