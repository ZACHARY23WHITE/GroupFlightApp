import { NextResponse } from "next/server";
import { getTripIdByShareCode, getTripMeta } from "@/lib/firestore-trips";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const id = await getTripIdByShareCode(raw);

  if (!id) {
    return NextResponse.json({ error: "No trip with that code." }, { status: 404 });
  }

  const meta = await getTripMeta(id);
  return NextResponse.json({
    id,
    name: meta?.name ?? "",
    shareCode: meta?.shareCode ?? raw,
  });
}
