import { NextResponse } from "next/server";
import {
  getTripWithTravelers,
  updatePollDeadline,
  updateTripName,
} from "@/lib/firestore-trips";
import {
  getWinners,
  type TripBriefDto,
  updateTripBrief,
} from "@/lib/firestore-trip-collab";

type Ctx = { params: Promise<{ id: string }> };

function tripJson(
  trip: NonNullable<Awaited<ReturnType<typeof getTripWithTravelers>>>,
  winners?: Awaited<ReturnType<typeof getWinners>>
) {
  return {
    id: trip.id,
    name: trip.name,
    shareCode: trip.shareCode,
    brief: trip.brief,
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
  };
}

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

function parseBriefPatch(
  body: Record<string, unknown>
):
  | { hasBriefKeys: false }
  | { hasBriefKeys: true; ok: true; brief: TripBriefDto }
  | { hasBriefKeys: true; ok: false; error: string } {
  const keys = [
    "briefPurpose",
    "briefBudget",
    "briefConstraints",
    "briefDateEarliest",
    "briefDateLatest",
  ] as const;
  if (!keys.some((k) => k in body)) return { hasBriefKeys: false };
  const s = (k: string) =>
    typeof body[k] === "string" ? (body[k] as string) : "";
  const dateEarliest = s("briefDateEarliest").trim();
  const dateLatest = s("briefDateLatest").trim();
  if (dateEarliest && !dateRe.test(dateEarliest)) {
    return {
      hasBriefKeys: true,
      ok: false,
      error: "briefDateEarliest must be YYYY-MM-DD when provided.",
    };
  }
  if (dateLatest && !dateRe.test(dateLatest)) {
    return {
      hasBriefKeys: true,
      ok: false,
      error: "briefDateLatest must be YYYY-MM-DD when provided.",
    };
  }
  return {
    hasBriefKeys: true,
    ok: true,
    brief: {
      purpose: s("briefPurpose"),
      budgetNotes: s("briefBudget"),
      constraintsNotes: s("briefConstraints"),
      dateEarliest,
      dateLatest,
    },
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const trip = await getTripWithTravelers(id);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const winners = trip.phase === "flights" ? await getWinners(id) : undefined;
  return NextResponse.json(tripJson(trip, winners));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  const name =
    "name" in b && typeof b.name === "string" ? b.name.trim() : null;

  // pollDeadline: ISO string to set, empty string or null to clear
  const hasPollDeadlineKey = "pollDeadline" in b;
  const rawDeadline = b.pollDeadline;
  let pollDeadlineToSave: string | null | undefined = undefined; // undefined = not updating
  if (hasPollDeadlineKey) {
    if (rawDeadline === null || rawDeadline === "") {
      pollDeadlineToSave = null;
    } else if (typeof rawDeadline === "string") {
      const d = new Date(rawDeadline);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "pollDeadline must be a valid ISO datetime." }, { status: 400 });
      }
      pollDeadlineToSave = d.toISOString();
    } else {
      return NextResponse.json({ error: "pollDeadline must be an ISO datetime string or null." }, { status: 400 });
    }
  }

  const briefResult = parseBriefPatch(b);
  if (briefResult.hasBriefKeys && !briefResult.ok) {
    return NextResponse.json({ error: briefResult.error }, { status: 400 });
  }

  const briefToSave =
    briefResult.hasBriefKeys && briefResult.ok ? briefResult.brief : null;

  const hasAnyUpdate = name !== null || briefToSave !== null || pollDeadlineToSave !== undefined;
  if (!hasAnyUpdate) {
    return NextResponse.json(
      { error: "Provide name, brief fields, or pollDeadline." },
      { status: 400 }
    );
  }

  if (name !== null && (!name || name.length > 120)) {
    return NextResponse.json(
      { error: "Valid name is required (max 120 characters)." },
      { status: 400 }
    );
  }

  let trip = await getTripWithTravelers(id);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (name !== null) {
    trip = await updateTripName(id, name);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
  }

  if (briefToSave) {
    const ok = await updateTripBrief(id, briefToSave);
    if (!ok) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
    trip = await getTripWithTravelers(id);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
  }

  if (pollDeadlineToSave !== undefined) {
    trip = await updatePollDeadline(id, pollDeadlineToSave);
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }
  }

  const winners = trip.phase === "flights" ? await getWinners(id) : undefined;
  return NextResponse.json(tripJson(trip, winners));
}
