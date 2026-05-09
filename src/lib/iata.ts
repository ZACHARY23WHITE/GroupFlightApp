export function normalizeIata(code: string): string | null {
  const c = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return null;
  return c;
}
