import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      travelers: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  return NextResponse.json({
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
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name =
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof (body as { name: unknown }).name === "string"
      ? (body as { name: string }).name.trim()
      : null;

  if (name === null || !name || name.length > 120) {
    return NextResponse.json(
      { error: "Valid name is required (max 120 characters)." },
      { status: 400 }
    );
  }

  try {
    const trip = await prisma.trip.update({
      where: { id },
      data: { name },
      include: {
        travelers: { orderBy: { createdAt: "asc" } },
      },
    });
    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
}
