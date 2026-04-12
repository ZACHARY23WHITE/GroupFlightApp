import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeIata } from "@/lib/iata";
import { CABIN_OPTIONS } from "@/lib/travel-class";

type Ctx = { params: Promise<{ id: string }> };

const CABIN_VALUES = new Set<string>(CABIN_OPTIONS.map((o) => o.value));

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parsePartyInt(
  body: Record<string, unknown>,
  key: string,
  def: number,
  min: number,
  max: number
): number {
  const v = body[key];
  if (v === undefined || v === null) return def;
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number.parseInt(v, 10)
        : NaN;
  if (!Number.isFinite(n)) return def;
  return clampInt(Math.trunc(n), min, max);
}

export async function POST(req: Request, ctx: Ctx) {
  const { id: tripId } = await ctx.params;

  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const displayName =
    "displayName" in body && typeof body.displayName === "string"
      ? body.displayName.trim()
      : "";
  const homeRaw =
    "homeAirport" in body && typeof body.homeAirport === "string"
      ? body.homeAirport
      : "";

  const homeAirport = normalizeIata(homeRaw);
  if (!displayName || displayName.length > 80) {
    return NextResponse.json(
      { error: "Display name is required (max 80 characters)." },
      { status: 400 }
    );
  }
  if (!homeAirport) {
    return NextResponse.json(
      { error: "Home airport must be a 3-letter IATA code (e.g. SEA, JFK)." },
      { status: 400 }
    );
  }

  const b = body as Record<string, unknown>;
  const adults = parsePartyInt(b, "adults", 1, 1, 9);
  const children = parsePartyInt(b, "children", 0, 0, 8);
  const cabinRaw = b.cabinClass;
  const cabinClass =
    typeof cabinRaw === "string" && CABIN_VALUES.has(cabinRaw)
      ? cabinRaw
      : "economy";

  const traveler = await prisma.traveler.create({
    data: { tripId, displayName, homeAirport, adults, children, cabinClass },
  });

  return NextResponse.json({
    id: traveler.id,
    displayName: traveler.displayName,
    homeAirport: traveler.homeAirport,
    adults: traveler.adults,
    children: traveler.children,
    cabinClass: traveler.cabinClass,
  });
}
