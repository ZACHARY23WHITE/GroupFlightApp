import { NextResponse } from "next/server";
import { getTripWithTravelers } from "@/lib/firestore-trips";
import { resolveFlyInto } from "@/lib/resolve-fly-into";
import { demoFlightOptions } from "@/lib/demo-flights";
import { buildGoogleFlightsFltUrl } from "@/lib/google-flights-url";
import {
  fetchGoogleFlightsTopOffers,
  type ParsedFlightOption,
} from "@/lib/serpapi-google-flights";
import { toSerpTravelClass } from "@/lib/travel-class";

type Ctx = { params: Promise<{ id: string }> };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export type QuoteRowResponse = {
  travelerId: string;
  displayName: string;
  origin: string;
  destination: string;
  adults: number;
  children: number;
  cabinClass: string;
  currency: string | null;
  error: string | null;
  viewAllUrl: string | null;
  options: ParsedFlightOption[];
};

export async function POST(req: Request, ctx: Ctx) {
  const { id: tripId } = await ctx.params;

  const trip = await getTripWithTravelers(tripId);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (trip.travelers.length === 0) {
    return NextResponse.json(
      { error: "Add at least one traveler with a home airport first." },
      { status: 400 }
    );
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

  const destRaw =
    "destination" in body && typeof body.destination === "string"
      ? body.destination
      : "";
  const departureDate =
    "departureDate" in body && typeof body.departureDate === "string"
      ? body.departureDate.trim()
      : "";
  const returnDate =
    "returnDate" in body && typeof body.returnDate === "string"
      ? body.returnDate.trim()
      : undefined;

  const resolvedDest = resolveFlyInto(destRaw);
  if (!resolvedDest.ok) {
    return NextResponse.json(
      {
        error: resolvedDest.error,
        suggestions: resolvedDest.suggestions ?? [],
      },
      { status: 400 }
    );
  }
  const destination = resolvedDest.iata;
  const destinationLabel = resolvedDest.label;
  if (!dateRe.test(departureDate)) {
    return NextResponse.json(
      { error: "departureDate must be YYYY-MM-DD." },
      { status: 400 }
    );
  }
  if (returnDate !== undefined && returnDate !== "" && !dateRe.test(returnDate)) {
    return NextResponse.json(
      { error: "returnDate must be YYYY-MM-DD when provided." },
      { status: 400 }
    );
  }

  const returnDateOrUndefined =
    returnDate && returnDate.length > 0 ? returnDate : undefined;

  const useSerp =
    Boolean(process.env.SERPAPI_API_KEY?.trim()) &&
    process.env.SERPAPI_DISABLED !== "true";
  const source: "google_flights" | "demo" = useSerp ? "google_flights" : "demo";

  const rows: QuoteRowResponse[] = await Promise.all(
    trip.travelers.map(async (t) => {
      const perPersonFlt = buildGoogleFlightsFltUrl({
        origin: t.homeAirport,
        destination,
        departureDate,
        returnDate: returnDateOrUndefined,
      });
      const adults = t.adults;
      const children = t.children;
      const cabinClass = t.cabinClass;
      const travelClass = toSerpTravelClass(cabinClass);

      if (useSerp) {
        const offer = await fetchGoogleFlightsTopOffers({
          origin: t.homeAirport,
          destination,
          departureDate,
          returnDate: returnDateOrUndefined,
          adults,
          children,
          travelClass,
        });
        if (offer.ok) {
          return {
            travelerId: t.id,
            displayName: t.displayName,
            origin: t.homeAirport,
            destination,
            adults,
            children,
            cabinClass,
            currency: offer.currency,
            error: null,
            viewAllUrl: offer.viewAllUrl ?? perPersonFlt,
            options: offer.options,
          };
        }
        return {
          travelerId: t.id,
          displayName: t.displayName,
          origin: t.homeAirport,
          destination,
          adults,
          children,
          cabinClass,
          currency: null,
          error: offer.message,
          viewAllUrl: perPersonFlt,
          options: [],
        };
      }

      const demo = demoFlightOptions(
        t.homeAirport,
        destination,
        departureDate,
        returnDateOrUndefined,
        { adults, children, cabinClass }
      );
      return {
        travelerId: t.id,
        displayName: t.displayName,
        origin: t.homeAirport,
        destination,
        adults,
        children,
        cabinClass,
        currency: demo.currency,
        error: null,
        viewAllUrl: perPersonFlt,
        options: demo.options,
      };
    })
  );

  let groupTotal = 0;
  let groupCurrency = "USD";
  let anyOption = false;
  for (const r of rows) {
    if (r.options.length > 0) {
      anyOption = true;
      groupTotal += Number.parseFloat(r.options[0]!.price);
      if (r.currency) groupCurrency = r.currency;
    }
  }

  type PartyFairness = {
    travelerId: string;
    displayName: string;
    adults: number;
    children: number;
    cheapestPartyTotal: number | null;
    currency: string | null;
    hasQuote: boolean;
  };

  const parties: PartyFairness[] = rows.map((r) => {
    const first = r.options[0];
    const n = first ? Number.parseFloat(first.price) : NaN;
    const cheapest = Number.isFinite(n) ? n : null;
    return {
      travelerId: r.travelerId,
      displayName: r.displayName,
      adults: r.adults,
      children: r.children,
      cheapestPartyTotal: cheapest,
      currency: r.currency,
      hasQuote: Boolean(first && cheapest !== null),
    };
  });

  const priced = parties.filter(
    (p): p is PartyFairness & { cheapestPartyTotal: number } =>
      p.cheapestPartyTotal !== null
  );
  const values = priced.map((p) => p.cheapestPartyTotal).sort((a, b) => a - b);
  const medianCheapest =
    values.length === 0
      ? null
      : values.length % 2 === 1
        ? values[(values.length - 1) / 2]!
        : (values[values.length / 2 - 1]! + values[values.length / 2]!) / 2;
  const minV = values.length ? values[0]! : null;
  const maxV = values.length ? values[values.length - 1]! : null;
  const spread =
    minV !== null && maxV !== null ? Math.max(0, maxV - minV) : null;
  const lowest = priced.find((p) => p.cheapestPartyTotal === minV);
  const highest = priced.find((p) => p.cheapestPartyTotal === maxV);

  const fairness = {
    parties,
    medianCheapest:
      medianCheapest !== null ? medianCheapest.toFixed(2) : null,
    spread: spread !== null ? spread.toFixed(2) : null,
    lowestPartyName: lowest?.displayName ?? null,
    highestPartyName: highest?.displayName ?? null,
    relativeSpreadPercent:
      spread !== null && medianCheapest !== null && medianCheapest > 0
        ? ((spread / medianCheapest) * 100).toFixed(0)
        : null,
    note:
      priced.length < 2
        ? "Add quotes for at least two travelers to compare how costs spread across parties."
        : "Each amount is the cheapest shown fare for that traveler’s party (adults + children), not per person. Spread is highest minus lowest party total — a rough fairness signal when origins differ.",
  };

  return NextResponse.json({
    source,
    destination,
    destinationLabel,
    departureDate,
    returnDate: returnDateOrUndefined ?? null,
    rows,
    groupTotal:
      anyOption && Number.isFinite(groupTotal) ? groupTotal.toFixed(2) : null,
    groupCurrency,
    groupTotalNote:
      "Sum of each traveler’s cheapest option among the top 3. Each price is for that traveler’s party (adults + children), not one group ticket.",
    fairness,
  });
}
