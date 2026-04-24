import { NextResponse } from "next/server";
import { rememberTripForUser } from "@/lib/firestore-user-trips";
import { verifyBearerUid } from "@/lib/verify-bearer";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const { id: tripId } = await ctx.params;
  try {
    const ok = await rememberTripForUser(uid, tripId);
    if (!ok) {
      return NextResponse.json({ error: "Trip not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/trips/[id]/remember:", e);
    const msg = e instanceof Error ? e.message : "Could not save trip.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
