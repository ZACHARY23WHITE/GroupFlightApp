import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TripWorkspace } from "./trip-workspace";

type PageProps = { params: Promise<{ id: string }> };

export default async function TripPage({ params }: PageProps) {
  const { id } = await params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: { travelers: { orderBy: { createdAt: "asc" } } },
  });

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
