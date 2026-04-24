/**
 * Best-effort links: airlines rarely expose stable “this exact fare” URLs.
 * FlightAware accepts many IATA+number identifiers (e.g. WN649, UA123).
 */

/** IATA (2-letter) → airline marketing site */
export const IATA_AIRLINE_HOME: Record<string, string> = {
  AA: "https://www.aa.com",
  AS: "https://www.alaskaair.com",
  B6: "https://www.jetblue.com",
  DL: "https://www.delta.com",
  F9: "https://www.flyfrontier.com",
  G4: "https://www.allegiantair.com",
  HA: "https://www.hawaiianairlines.com",
  NK: "https://www.spirit.com",
  SY: "https://www.suncountry.com",
  UA: "https://www.united.com",
  WN: "https://www.southwest.com",
  AC: "https://www.aircanada.com",
  AF: "https://www.airfrance.com",
  BA: "https://www.britishairways.com",
  LH: "https://www.lufthansa.com",
  NH: "https://www.ana.co.jp",
  JL: "https://www.jal.co.jp",
  QF: "https://www.qantas.com",
  VS: "https://www.virginatlantic.com",
  EK: "https://www.emirates.com",
  QR: "https://www.qatarairways.com",
};

export type ParsedFlightNumber = {
  iata: string;
  number: string;
  /** e.g. WN649 — used by FlightAware */
  flightAwareIdent: string;
};

export function parsePrimaryFlightNumber(
  flightNumberField: string | undefined
): ParsedFlightNumber | null {
  if (!flightNumberField || flightNumberField === "—") return null;
  const t = flightNumberField.trim();
  // "WN 649", "NH 962", "UA2175"
  const m = t.match(/^([A-Za-z]{2,3})\s*(\d{1,4})\s*$/);
  if (!m) return null;
  const letters = m[1]!.toUpperCase();
  const digits = m[2]!;
  const iata = letters.length === 2 ? letters : letters.slice(0, 2);
  const flightAwareIdent = `${letters}${digits}`;
  return { iata, number: digits, flightAwareIdent };
}

export function flightAwareUrl(flightAwareIdent: string): string {
  return `https://www.flightaware.com/live/flight/${encodeURIComponent(flightAwareIdent)}`;
}

export function airlineHomepageUrl(iataFromFlight: string): string | null {
  const code = iataFromFlight.toUpperCase();
  return IATA_AIRLINE_HOME[code] ?? null;
}

/** Google search tuned to surface the carrier’s booking / flight pages */
export function googleFlightSearchUrl(params: {
  airlineName: string;
  flightNumber: string;
  dateYyyyMmDd: string;
}): string {
  const q = `${params.airlineName} ${params.flightNumber} flight ${params.dateYyyyMmDd} book`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

/** Extract YYYY-MM-DD from SerpAPI-style "2025-10-14 11:30" */
export function extractIsoDateFromSchedule(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : null;
}
