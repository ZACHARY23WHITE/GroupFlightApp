const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Formats SerpAPI-style local timestamps like "2025-10-14 11:30" without
 * timezone conversion (treats the clock time as given).
 */
export function formatFlightDateTime(raw: string): string {
  const s = raw.trim();
  if (!s || s === "—") return raw;

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) return raw;

  const year = m[1]!;
  const monthIdx = Number.parseInt(m[2]!, 10) - 1;
  const day = Number.parseInt(m[3]!, 10);
  let hour24 = Number.parseInt(m[4]!, 10);
  const minute = Number.parseInt(m[5]!, 10);

  if (
    monthIdx < 0 ||
    monthIdx > 11 ||
    day < 1 ||
    day > 31 ||
    hour24 < 0 ||
    hour24 > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return raw;
  }

  const monthName = MONTHS[monthIdx]!;
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;
  const mm = String(minute).padStart(2, "0");
  const ampm = isPm ? "pm" : "am";

  return `${monthName} ${day}, ${year} at ${hour12}:${mm}${ampm}`;
}
