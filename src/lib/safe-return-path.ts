/** Internal redirect target from `next` query — only same-origin paths allowed. */
export function safeReturnPath(next: string | null | undefined): string {
  const n = (next ?? "").trim() || "/";
  if (!n.startsWith("/") || n.startsWith("//")) return "/";
  return n;
}
