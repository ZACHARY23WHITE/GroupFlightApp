import type { ParsedFlightOption } from "@/lib/serpapi-google-flights";
import { cabinLabel } from "@/lib/travel-class";

function hashSeed(origin: string, destination: string): number {
  let h = 0;
  for (const c of origin + destination) {
    h = (h * 31 + c.charCodeAt(0)) >>> 0;
  }
  return h;
}

/** Deterministic placeholder totals when SerpAPI is not configured. */
export function demoRoundTripTotal(origin: string, destination: string): {
  total: string;
  currency: string;
} {
  const base = 180 + (hashSeed(origin, destination) % 520);
  return { total: base.toFixed(2), currency: "USD" };
}

/** Three fake itineraries for demo mode. */
export function demoFlightOptions(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
  party?: { adults: number; children: number; cabinClass: string }
): { options: ParsedFlightOption[]; currency: string } {
  const h = hashSeed(origin, destination);
  const base = 180 + (h % 520);
  const adults = party?.adults ?? 1;
  const children = party?.children ?? 0;
  const cabinClass = party?.cabinClass ?? "economy";
  const partyMult = Math.max(1, adults + children * 0.9);
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const retNote = returnDate ? ` (returns ${returnDate})` : "";
  const primaryClass = cabinLabel(cabinClass);

  const mk = (
    offset: number,
    depH: number,
    arrH: number,
    airline: string,
    fn: string,
    cls: string
  ): ParsedFlightOption => ({
    price: ((base + offset) * partyMult).toFixed(2),
    departureTime: `${departureDate} ${String(depH).padStart(2, "0")}:15`,
    arrivalTime: `${departureDate} ${String(arrH).padStart(2, "0")}:42${retNote}`,
    airlines: [airline],
    travelClass: cls,
    flightNumbers: [fn],
    routeSummary: `${o} → ${d}`,
  });

  return {
    currency: "USD",
    options: [
      mk(0, 7, 11, "Demo Airways", `DM ${100 + (h % 700)}`, primaryClass),
      mk(52, 12, 17, "Sample Jet", `SJ ${200 + (h % 500)}`, primaryClass),
      mk(
        140,
        18,
        22,
        "Mock Airlines",
        `MK ${300 + (h % 400)}`,
        cabinClass === "economy" ? "Premium economy" : primaryClass
      ),
    ],
  };
}
