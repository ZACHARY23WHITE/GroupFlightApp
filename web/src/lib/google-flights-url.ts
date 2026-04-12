/** Fallback deep link when SerpAPI does not return `google_flights_url`. Unofficial but widely used. */
export function buildGoogleFlightsFltUrl(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
}): string {
  const { origin, destination, departureDate, returnDate } = params;
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const base = "https://www.google.com/travel/flights?hl=en";
  if (returnDate) {
    const flt = `${o}.${d}.${departureDate}*${d}.${o}.${returnDate}`;
    return `${base}#flt=${flt}`;
  }
  return `${base}#flt=${o}.${d}.${departureDate}`;
}

/** Google Flights Explore — map / flexible destination browse (opens in booking site). */
export function buildGoogleTravelExploreUrl(): string {
  return "https://www.google.com/travel/explore?hl=en&gl=us";
}

/** Best-effort Explore search hint from home airport codes (Google may refine in UI). */
export function buildGoogleExploreHintFromOrigins(iataCodes: string[]): string {
  const base = "https://www.google.com/travel/explore?hl=en&gl=us";
  const codes = [...new Set(iataCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (codes.length === 0) return base;
  const q = `Flights from ${codes.join(" ")}`;
  return `${base}&q=${encodeURIComponent(q)}`;
}
