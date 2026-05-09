import { NextResponse } from "next/server";
import { normalizeIata } from "@/lib/iata";
import { fetchGoogleTravelExploreDestinations } from "@/lib/serpapi-google-travel-explore";
import { CABIN_OPTIONS } from "@/lib/travel-class";

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

const CABIN_VALUES = new Set<string>(CABIN_OPTIONS.map((o) => o.value));

export async function POST(req: Request) {
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
  const depRaw =
    typeof b.departureId === "string" ? b.departureId : "";
  const departureId = normalizeIata(depRaw);
  if (!departureId) {
    return NextResponse.json(
      { error: "departureId must be a 3-letter IATA airport code (e.g. SEA)." },
      { status: 400 }
    );
  }

  const tripType =
    b.tripType === "one_way" ? "one_way" : "round_trip";
  const dateMode = b.dateMode === "flexible" ? "flexible" : "calendar";

  const outboundDate =
    typeof b.outboundDate === "string" ? b.outboundDate.trim() : "";
  const returnDate =
    typeof b.returnDate === "string" ? b.returnDate.trim() : "";

  const monthRaw = b.month;
  const month =
    typeof monthRaw === "number"
      ? monthRaw
      : typeof monthRaw === "string"
        ? Number.parseInt(monthRaw, 10)
        : NaN;

  const tdRaw = b.travelDuration;
  const travelDuration =
    typeof tdRaw === "number"
      ? tdRaw
      : typeof tdRaw === "string"
        ? Number.parseInt(tdRaw, 10)
        : NaN;

  const adultsRaw = b.adults;
  const adults =
    typeof adultsRaw === "number"
      ? adultsRaw
      : typeof adultsRaw === "string"
        ? Number.parseInt(adultsRaw, 10)
        : 1;

  const childrenRaw = b.children;
  const children =
    typeof childrenRaw === "number"
      ? childrenRaw
      : typeof childrenRaw === "string"
        ? Number.parseInt(childrenRaw, 10)
        : 0;

  const cabinRaw = b.cabinClass;
  const cabinClass =
    typeof cabinRaw === "string" && CABIN_VALUES.has(cabinRaw)
      ? cabinRaw
      : "economy";

  if (dateMode === "calendar") {
    if (!dateRe.test(outboundDate)) {
      return NextResponse.json(
        { error: "outboundDate must be YYYY-MM-DD." },
        { status: 400 }
      );
    }
    if (tripType === "round_trip") {
      if (!dateRe.test(returnDate)) {
        return NextResponse.json(
          { error: "returnDate must be YYYY-MM-DD for round trips." },
          { status: 400 }
        );
      }
    }
  } else {
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "For flexible dates, month must be 1–12 (e.g. April = 4)." },
        { status: 400 }
      );
    }
    if (
      !Number.isFinite(travelDuration) ||
      travelDuration < 1 ||
      travelDuration > 3
    ) {
      return NextResponse.json(
        {
          error:
            "travelDuration must be 1 (weekend), 2 (one week), or 3 (two weeks).",
        },
        { status: 400 }
      );
    }
  }

  const result = await fetchGoogleTravelExploreDestinations({
    departureId,
    tripType,
    dateMode,
    outboundDate: dateMode === "calendar" ? outboundDate : undefined,
    returnDate:
      dateMode === "calendar" && tripType === "round_trip"
        ? returnDate
        : undefined,
    month: dateMode === "flexible" ? month : undefined,
    travelDuration: dateMode === "flexible" ? travelDuration : undefined,
    adults: Number.isFinite(adults) ? adults : 1,
    children: Number.isFinite(children) ? children : 0,
    cabinClass,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 502 });
  }

  return NextResponse.json({
    source: result.source,
    currency: result.currency,
    googleExploreUrl: result.googleExploreUrl,
    destinations: result.destinations,
    tripType,
    dateMode,
    departureId,
  });
}
