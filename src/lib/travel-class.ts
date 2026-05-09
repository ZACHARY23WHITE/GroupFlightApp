/** SerpAPI `travel_class`: 1 Economy, 2 Premium economy, 3 Business, 4 First */

export const CABIN_OPTIONS = [
  { value: "economy", label: "Economy" },
  { value: "premium_economy", label: "Premium economy" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
] as const;

export type CabinClassId = (typeof CABIN_OPTIONS)[number]["value"];

export function toSerpTravelClass(cabin: string): "1" | "2" | "3" | "4" {
  switch (cabin) {
    case "premium_economy":
      return "2";
    case "business":
      return "3";
    case "first":
      return "4";
    default:
      return "1";
  }
}

export function cabinLabel(cabin: string): string {
  return CABIN_OPTIONS.find((o) => o.value === cabin)?.label ?? "Economy";
}
