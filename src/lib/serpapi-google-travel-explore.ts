/**
 * SerpAPI Google Travel Explore — destination discovery (Explore-style results).
 * @see https://serpapi.com/google-travel-explore-api
 */

import { toSerpTravelClass } from "@/lib/travel-class";

export type ExploreDestinationDto = {
  destinationId: string;
  name: string;
  country: string;
  airportCode: string | null;
  thumbnail: string | null;
  startDate: string | null;
  endDate: string | null;
  flightPrice: number | null;
  hotelPrice: number | null;
  flightDurationMinutes: number | null;
  stops: number | null;
  airline: string | null;
  googleTravelUrl: string | null;
};

type SerpExploreResponse = {
  error?: string;
  search_metadata?: {
    google_travel_explore_url?: string;
    status?: string;
  };
  search_parameters?: Record<string, unknown>;
  destinations?: unknown[];
};

function parseDestination(raw: Record<string, unknown>): ExploreDestinationDto | null {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return null;
  const destId =
    typeof raw.destination_id === "string" ? raw.destination_id : "";
  const country = typeof raw.country === "string" ? raw.country : "";
  const airportRaw = raw.destination_airport;
  let airportCode: string | null = null;
  if (airportRaw && typeof airportRaw === "object") {
    const a = airportRaw as Record<string, unknown>;
    if (typeof a.code === "string") airportCode = a.code;
  }
  const thumb =
    typeof raw.thumbnail === "string" && raw.thumbnail.startsWith("http")
      ? raw.thumbnail
      : null;
  const startDate = typeof raw.start_date === "string" ? raw.start_date : null;
  const endDate = typeof raw.end_date === "string" ? raw.end_date : null;
  const flightPrice =
    typeof raw.flight_price === "number" && Number.isFinite(raw.flight_price)
      ? raw.flight_price
      : null;
  const hotelPrice =
    typeof raw.hotel_price === "number" && Number.isFinite(raw.hotel_price)
      ? raw.hotel_price
      : null;
  const flightDuration =
    typeof raw.flight_duration === "number" &&
    Number.isFinite(raw.flight_duration)
      ? raw.flight_duration
      : null;
  const stops =
    typeof raw.number_of_stops === "number" &&
    Number.isFinite(raw.number_of_stops)
      ? raw.number_of_stops
      : null;
  const airline = typeof raw.airline === "string" ? raw.airline : null;
  const googleTravelUrl =
    typeof raw.link === "string" && raw.link.startsWith("http")
      ? raw.link
      : null;

  return {
    destinationId: destId || name,
    name,
    country,
    airportCode,
    thumbnail: thumb,
    startDate,
    endDate,
    flightPrice,
    hotelPrice,
    flightDurationMinutes: flightDuration,
    stops,
    airline,
    googleTravelUrl,
  };
}

function demoDestinations(): ExploreDestinationDto[] {
  return [
    {
      destinationId: "demo-san-diego",
      name: "San Diego",
      country: "United States",
      airportCode: "SAN",
      thumbnail: null,
      startDate: "2026-05-08",
      endDate: "2026-05-15",
      flightPrice: 178,
      hotelPrice: 189,
      flightDurationMinutes: 165,
      stops: 0,
      airline: "Demo Air",
      googleTravelUrl: "https://www.google.com/travel/explore",
    },
    {
      destinationId: "demo-denver",
      name: "Denver",
      country: "United States",
      airportCode: "DEN",
      thumbnail: null,
      startDate: "2026-05-01",
      endDate: "2026-05-08",
      flightPrice: 142,
      hotelPrice: 156,
      flightDurationMinutes: 148,
      stops: 0,
      airline: "Demo Air",
      googleTravelUrl: "https://www.google.com/travel/explore",
    },
    {
      destinationId: "demo-cancun",
      name: "Cancún",
      country: "Mexico",
      airportCode: "CUN",
      thumbnail: null,
      startDate: "2026-04-18",
      endDate: "2026-04-25",
      flightPrice: 312,
      hotelPrice: 210,
      flightDurationMinutes: 275,
      stops: 0,
      airline: "Demo Air",
      googleTravelUrl: "https://www.google.com/travel/explore",
    },
    {
      destinationId: "demo-dublin",
      name: "Dublin",
      country: "Ireland",
      airportCode: "DUB",
      thumbnail: null,
      startDate: "2026-06-05",
      endDate: "2026-06-12",
      flightPrice: 489,
      hotelPrice: 175,
      flightDurationMinutes: 420,
      stops: 1,
      airline: "Demo Air",
      googleTravelUrl: "https://www.google.com/travel/explore",
    },
  ];
}

export type ExploreSearchInput = {
  departureId: string;
  tripType: "round_trip" | "one_way";
  dateMode: "calendar" | "flexible";
  outboundDate?: string;
  returnDate?: string;
  month?: number;
  travelDuration?: number;
  adults: number;
  children: number;
  cabinClass: string;
  currency?: string;
};

export async function fetchGoogleTravelExploreDestinations(
  input: ExploreSearchInput
): Promise<
  | {
      ok: true;
      source: "google_travel_explore" | "demo";
      currency: string;
      googleExploreUrl: string | null;
      destinations: ExploreDestinationDto[];
    }
  | { ok: false; message: string }
> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  const useSerp =
    Boolean(apiKey) && process.env.SERPAPI_DISABLED !== "true";
  const currency = input.currency ?? "USD";
  const adults = Math.min(9, Math.max(1, input.adults));
  const children = Math.min(8, Math.max(0, input.children));
  const travelClass = toSerpTravelClass(input.cabinClass);

  if (!useSerp) {
    const demo = demoDestinations().sort(
      (a, b) =>
        (a.flightPrice ?? 0) - (b.flightPrice ?? 0)
    );
    return {
      ok: true,
      source: "demo",
      currency,
      googleExploreUrl: null,
      destinations: demo,
    };
  }

  const searchParams = new URLSearchParams({
    engine: "google_travel_explore",
    api_key: apiKey!,
    departure_id: input.departureId,
    currency,
    hl: process.env.SERPAPI_HL?.trim() || "en",
    gl: process.env.SERPAPI_GL?.trim() || "us",
    type: input.tripType === "round_trip" ? "1" : "2",
    adults: String(adults),
    travel_class: travelClass,
  });
  if (children > 0) {
    searchParams.set("children", String(children));
  }

  if (input.dateMode === "calendar") {
    if (input.outboundDate) {
      searchParams.set("outbound_date", input.outboundDate);
    }
    if (input.tripType === "round_trip" && input.returnDate) {
      searchParams.set("return_date", input.returnDate);
    }
  } else {
    if (typeof input.month === "number" && input.month >= 1 && input.month <= 12) {
      searchParams.set("month", String(input.month));
    }
    if (
      typeof input.travelDuration === "number" &&
      input.travelDuration >= 1 &&
      input.travelDuration <= 3
    ) {
      searchParams.set("travel_duration", String(input.travelDuration));
    }
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
          "Explore search timed out. SerpAPI can take 30–90s; try again or set SERPAPI_TIMEOUT_MS in .env.",
      };
    }
    return {
      ok: false,
      message:
        e instanceof Error ? e.message : "Could not reach SerpAPI (network error).",
    };
  }

  let data: SerpExploreResponse;
  try {
    data = (await res.json()) as SerpExploreResponse;
  } catch {
    return { ok: false, message: "Invalid response from SerpAPI." };
  }

  if (data.error) {
    return { ok: false, message: data.error };
  }
  if (!res.ok) {
    return { ok: false, message: `SerpAPI request failed (${res.status}).` };
  }

  const rawList = Array.isArray(data.destinations) ? data.destinations : [];
  const destinations: ExploreDestinationDto[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const row = parseDestination(item as Record<string, unknown>);
    if (row) destinations.push(row);
  }

  destinations.sort(
    (a, b) => (a.flightPrice ?? 1e9) - (b.flightPrice ?? 1e9)
  );

  const exploreUrl =
    typeof data.search_metadata?.google_travel_explore_url === "string" &&
    data.search_metadata.google_travel_explore_url.startsWith("http")
      ? data.search_metadata.google_travel_explore_url
      : null;

  if (destinations.length === 0) {
    return {
      ok: false,
      message:
        "No destinations returned. Try different dates, a nearby airport, or flexible month search.",
    };
  }

  return {
    ok: true,
    source: "google_travel_explore",
    currency,
    googleExploreUrl: exploreUrl,
    destinations: destinations.slice(0, 48),
  };
}
