import { NextResponse } from "next/server";
import { createTrip } from "@/lib/firestore-trips";
import { rememberTripForUser } from "@/lib/firestore-user-trips";
import { verifyBearerUid } from "@/lib/verify-bearer";

export async function POST(req: Request) {
  const uid = await verifyBearerUid(req);
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name =
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof (body as { name: unknown }).name === "string"
      ? (body as { name: string }).name.trim()
      : "";

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Trip name is required (max 120 characters)." },
      { status: 400 }
    );
  }

  try {
    const trip = await createTrip(name);
    if (uid) {
      try {
        await rememberTripForUser(uid, trip.id);
      } catch (e) {
        console.error("rememberTripForUser after create:", e);
      }
    }
    return NextResponse.json({ id: trip.id, shareCode: trip.shareCode });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("POST /api/trips:", e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
