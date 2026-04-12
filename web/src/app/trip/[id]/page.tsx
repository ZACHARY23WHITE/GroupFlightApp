import { notFound } from "next/navigation";
import { getTripWithTravelers } from "@/lib/firestore-trips";
import { TripWorkspace } from "./trip-workspace";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: PageProps) {
  const { id } = await params;
  const trip = await getTripWithTravelers(id);

  if (!trip) notFound();

  return (
    <TripWorkspace
      initial={{
        id: trip.id,
        name: trip.name,
        shareCode: trip.shareCode,
        travelers: trip.travelers.map((t) => ({
          id: t.id,
          displayName: t.displayName,
          homeAirport: t.homeAirport,
          adults: t.adults,
          children: t.children,
          cabinClass: t.cabinClass,
        })),
      }}
    />
  );
}
