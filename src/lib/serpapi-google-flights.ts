/**
 * Google does not publish a public Flights API. This uses SerpAPI's
 * `engine=google_flights` to retrieve Google Flights–style results.
 * @see https://serpapi.com/google-flights-api
 */

export type FlightLeg = {
  departure_airport?: { name?: string; id?: string; time?: string };
  arrival_airport?: { name?: string; id?: string; time?: string };
  airline?: string;
  flight_number?: string;
  travel_class?: string;
};

export type SerpItinerary = {
  price?: number;
  type?: string;
  flights?: FlightLeg[];
};

type SerpGoogleFlightsResponse = {
  error?: string;
  search_metadata?: { google_flights_url?: string };
  best_flights?: SerpItinerary[];
  other_flights?: SerpItinerary[];
  price_insights?: { lowest_price?: number };
};

export type ParsedFlightOption = {
  price: string;
  departureTime: string;
  arrivalTime: string;
  airlines: string[];
  travelClass: string;
  flightNumbers: string[];
  /** Outbound first departure → final arrival airport codes (whole itinerary). */
  routeSummary: string;
};

const TOP_N = 3;

function parseItinerary(it: SerpItinerary): ParsedFlightOption | null {
  const flights = it.flights;
  if (!flights?.length || typeof it.price !== "number" || !Number.isFinite(it.price)) {
    return null;
  }
  const first = flights[0];
  const last = flights[flights.length - 1];
  const dep = first.departure_airport?.time?.trim() ?? "";
  const arr = last.arrival_airport?.time?.trim() ?? "";
  const airlines = [
    ...new Set(
      flights.map((f) => f.airline).filter((a): a is string => Boolean(a))
    ),
  ];
  const flightNumbers = flights
    .map((f) => f.flight_number)
    .filter((n): n is string => Boolean(n));
  const classes = [
    ...new Set(
      flights.map((f) => f.travel_class).filter((c): c is string => Boolean(c))
    ),
  ];
  const travelClass =
    classes.length === 0
      ? "Economy"
      : classes.length === 1
        ? classes[0]!
        : classes.join(" · ");
  const from = first.departure_airport?.id ?? "";
  const to = last.arrival_airport?.id ?? "";
  const routeSummary = from && to ? `${from} → ${to}` : "";

  return {
    price: it.price.toFixed(2),
    departureTime: dep || "—",
    arrivalTime: arr || "—",
    airlines: airlines.length ? airlines : ["—"],
    travelClass,
    flightNumbers: flightNumbers.length ? flightNumbers : ["—"],
    routeSummary,
  };
}

function optionDedupeKey(opt: ParsedFlightOption): string {
  return `${opt.price}|${opt.flightNumbers.join(",")}|${opt.departureTime}`;
}

function collectItineraries(data: SerpGoogleFlightsResponse): SerpItinerary[] {
  const raw = [data.best_flights, data.other_flights]
    .filter(Boolean)
    .flat() as SerpItinerary[];
  return raw;
}

export async function fetchGoogleFlightsTopOffers(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  currency?: string;
  adults?: number;
  children?: number;
  /** SerpAPI `travel_class`: "1" | "2" | "3" | "4" */
  travelClass?: string;
}): Promise<
  | {
      ok: true;
      currency: string;
      viewAllUrl: string | null;
      options: ParsedFlightOption[];
    }
  | { ok: false; message: string }
> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: "SerpAPI key is not configured." };
  }

  const currency = params.currency ?? "USD";
  const roundTrip = Boolean(params.returnDate);
  const adults = Math.min(9, Math.max(1, params.adults ?? 1));
  const children = Math.min(8, Math.max(0, params.children ?? 0));
  const travelClass = params.travelClass ?? "1";
  const searchParams = new URLSearchParams({
    engine: "google_flights",
    api_key: apiKey,
    departure_id: params.origin,
    arrival_id: params.destination,
    outbound_date: params.departureDate,
    currency,
    hl: process.env.SERPAPI_HL?.trim() || "en",
    gl: process.env.SERPAPI_GL?.trim() || "us",
    type: roundTrip ? "1" : "2",
    adults: String(adults),
    travel_class: travelClass,
  });
  if (children > 0) {
    searchParams.set("children", String(children));
  }

  if (roundTrip && params.returnDate) {
    searchParams.set("return_date", params.returnDate);
  }

  if (process.env.SERPAPI_DEEP_SEARCH === "true") {
    searchParams.set("deep_search", "true");
  }

  const url = `https://serpapi.com/search.json?${searchParams}`;
  const timeoutMs = Number.parseInt(
    process.env.SERPAPI_TIMEOUT_MS ?? "120000",
    10
  );
  let res: Response;
  try {
    res = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(Number.isFinite(timeoutMs) ? timeoutMs : 120000),
    });
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      return {
        ok: false,
        message:
          "Flight search timed out. SerpAPI can take 30–90s; try again or set SERPAPI_TIMEOUT_MS in .env.",
      };
    }
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Could not reach SerpAPI (network error).",
    };
  }

  let data: SerpGoogleFlightsResponse;
  try {
    data = (await res.json()) as SerpGoogleFlightsResponse;
  } catch {
    return { ok: false, message: "Invalid response from SerpAPI." };
  }

  if (data.error) {
    return { ok: false, message: data.error };
  }
  if (!res.ok) {
    return { ok: false, message: `SerpAPI request failed (${res.status}).` };
  }

  const itineraries = collectItineraries(data);
  const parsed: ParsedFlightOption[] = [];
  const seen = new Set<string>();
  for (const it of itineraries) {
    const opt = parseItinerary(it);
    if (!opt) continue;
    const key = optionDedupeKey(opt);
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(opt);
  }

  parsed.sort(
    (a, b) => Number.parseFloat(a.price) - Number.parseFloat(b.price)
  );

  const options = parsed.slice(0, TOP_N);

  if (options.length === 0) {
    return {
      ok: false,
      message: "No flight prices returned for this route and date.",
    };
  }

  const viewAllUrl =
    typeof data.search_metadata?.google_flights_url === "string" &&
    data.search_metadata.google_flights_url.startsWith("http")
      ? data.search_metadata.google_flights_url
      : null;

  return {
    ok: true,
    currency,
    viewAllUrl,
    options,
  };
}
