import { notFound } from "next/navigation";
import { getTripWithTravelers } from "@/lib/firestore-trips";
import { getWinners } from "@/lib/firestore-trip-collab";
import { TripWorkspace } from "./trip-workspace";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: PageProps) {
  const { id } = await params;
  const trip = await getTripWithTravelers(id);

  if (!trip) notFound();

  const winners = trip.phase === "flights" ? await getWinners(id) : null;

  return (
    <TripWorkspace
      initial={{
        id: trip.id,
        name: trip.name,
        shareCode: trip.shareCode,
        phase: trip.phase,
        pollDeadline: trip.pollDeadline,
        winningDestination: winners?.destination ?? null,
        winningDates: winners?.dates ?? null,
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
