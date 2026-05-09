import { NextResponse } from "next/server";
import { deleteTraveler } from "@/lib/firestore-trips";

type Ctx = { params: Promise<{ id: string; travelerId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: tripId, travelerId } = await ctx.params;

  const ok = await deleteTraveler(tripId, travelerId);
  if (!ok) {
    return NextResponse.json({ error: "Traveler not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
