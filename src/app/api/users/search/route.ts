import { NextResponse } from "next/server";
import { findUserByUsername, normalizeUsername } from "@/lib/firestore-profiles";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ user: null });
  }
  const normalized = normalizeUsername(q);
  if (normalized.length < 3) {
    return NextResponse.json({ user: null });
  }
  const user = await findUserByUsername(normalized);
  return NextResponse.json({ user });
}
