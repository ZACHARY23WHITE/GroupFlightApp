import { NextResponse } from "next/server";
import { listTripsForUser } from "@/lib/firestore-user-trips";
import { verifyBearerUid } from "@/lib/verify-bearer";

export async function GET(req: Request) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  try {
    const trips = await listTripsForUser(uid);
    return NextResponse.json({
      trips: trips.map((t) => ({
        id: t.id,
        name: t.name,
        shareCode: t.shareCode,
      })),
    });
  } catch (e) {
    console.error("GET /api/trips/mine:", e);
    const msg = e instanceof Error ? e.message : "Could not load trips.";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
