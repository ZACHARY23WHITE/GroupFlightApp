import { NextResponse } from "next/server";
import { verifyBearerUid } from "@/lib/verify-bearer";
import { getTripMeta } from "@/lib/firestore-trips";
import { getUserProfile, findUserByUsername, normalizeUsername } from "@/lib/firestore-profiles";
import { createTripInvite, listInvitesForTrip } from "@/lib/firestore-invites";
import { appendTripActivity } from "@/lib/firestore-trip-collab";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id: tripId } = await ctx.params;
  const trip = await getTripMeta(tripId);
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }

  const invites = await listInvitesForTrip(tripId);
  return NextResponse.json({ invites });
}

export async function POST(req: Request, ctx: Ctx) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { id: tripId } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  if (typeof b.username !== "string" || !b.username.trim()) {
    return NextResponse.json({ error: "username is required." }, { status: 400 });
  }

  const [trip, inviterProfile, invitee] = await Promise.all([
    getTripMeta(tripId),
    getUserProfile(uid),
    findUserByUsername(normalizeUsername(b.username)),
  ]);

  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  if (!invitee) {
    return NextResponse.json({ error: "No user found with that username." }, { status: 404 });
  }
  if (invitee.uid === uid) {
    return NextResponse.json({ error: "You can't invite yourself." }, { status: 400 });
  }

  const inviterName = inviterProfile?.displayName || "Someone";

  const invite = await createTripInvite({
    tripId,
    tripName: trip.name,
    tripShareCode: trip.shareCode,
    tripPurpose: "",
    tripDateEarliest: "",
    tripDateLatest: "",
    invitedByUid: uid,
    invitedByName: inviterName,
    invitedUid: invitee.uid,
    invitedUsername: invitee.username,
    invitedDisplayName: invitee.displayName,
  });

  await appendTripActivity(
    tripId,
    `${inviterName} invited ${invitee.displayName} (@${invitee.username}) to the trip.`
  );

  return NextResponse.json({ invite }, { status: 201 });
}
