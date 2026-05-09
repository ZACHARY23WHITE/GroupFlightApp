/**
 * Airport list derived from OpenFlights (ODbL). Used to map city names → IATA.
 */
import airportsJson from "@/data/airports.json";

export type AirportRow = {
  iata: string;
  city: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
};

const rows = airportsJson as AirportRow[];

const byIata = new Map(rows.map((r) => [r.iata, r]));

function normalizeQuery(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ");
}

function scoreMatch(row: AirportRow, qNorm: string): number {
  const city = row.city.toLowerCase();
  const name = row.name.toLowerCase();
  const country = row.country.toLowerCase();
  const iata = row.iata.toLowerCase();

  if (iata === qNorm && qNorm.length === 3) return 250;
  if (city === qNorm) return 200;
  if (name === qNorm) return 190;
  if (qNorm.length >= 3 && city.startsWith(qNorm)) return 150;
  if (qNorm.length >= 4 && name.startsWith(qNorm)) return 85;
  if (qNorm.length >= 3 && city.includes(qNorm)) return 70;
  if (qNorm.length >= 4 && name.includes(qNorm)) return 45;
  if (qNorm.length >= 4 && country.includes(qNorm)) return 15;
  return 0;
}

export type ResolveFlyIntoResult =
  | { ok: true; iata: string; label: string }
  | { ok: false; error: string; suggestions?: string[] };

export function resolveFlyInto(input: string): ResolveFlyIntoResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, error: "Destination is required." };
  }

  if (/^[A-Za-z]{3}$/.test(trimmed)) {
    const code = trimmed.toUpperCase();
    const found = byIata.get(code);
    if (found) {
      return {
        ok: true,
        iata: code,
        label: `${found.city} (${code})`,
      };
    }
    return {
      ok: false,
      error: `No airport with code “${code}”. Try a nearby city name instead.`,
    };
  }

  const qNorm = normalizeQuery(trimmed);
  if (qNorm.length < 3) {
    return {
      ok: false,
      error:
        "For a city, type at least three letters (e.g. “Denver”), or enter a 3-letter airport code (e.g. “DEN”).",
    };
  }

  const matches: { row: AirportRow; score: number }[] = [];
  for (const row of rows) {
    const s = scoreMatch(row, qNorm);
    if (s > 0) matches.push({ row, score: s });
  }

  matches.sort(
    (a, b) =>
      b.score - a.score ||
      a.row.city.localeCompare(b.row.city) ||
      a.row.iata.localeCompare(b.row.iata)
  );

  if (matches.length === 0) {
    return {
      ok: false,
      error: `No airport found for “${trimmed}”. Try a larger nearby city or a 3-letter IATA code (e.g. DEN, LAX).`,
    };
  }

  const bestScore = matches[0]!.score;
  const winners = matches.filter((m) => m.score === bestScore);
  if (winners.length > 1) {
    const suggestions = winners.slice(0, 8).map(
      (w) => `${w.row.city}, ${w.row.country} — ${w.row.name} (${w.row.iata})`
    );
    return {
      ok: false,
      error: `Several airports match “${trimmed}”. Pick a specific airport or use its 3-letter code.`,
      suggestions,
    };
  }

  const w = winners[0]!.row;
  return {
    ok: true,
    iata: w.iata,
    label: `${w.city} (${w.iata})`,
  };
}
