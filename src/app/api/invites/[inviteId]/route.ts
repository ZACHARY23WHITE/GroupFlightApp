import { NextResponse } from "next/server";
import { verifyBearerUid } from "@/lib/verify-bearer";
import { getInvite, rsvpInvite, type InviteStatus } from "@/lib/firestore-invites";
import { rememberTripForUser } from "@/lib/firestore-user-trips";
import { appendTripActivity } from "@/lib/firestore-trip-collab";

type Ctx = { params: Promise<{ inviteId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { inviteId } = await ctx.params;

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
  const validStatuses: InviteStatus[] = ["going", "maybe", "declined"];
  if (!validStatuses.includes(b.status as InviteStatus)) {
    return NextResponse.json(
      { error: "status must be going, maybe, or declined." },
      { status: 400 }
    );
  }
  const status = b.status as "going" | "maybe" | "declined";
  const declineComment =
    typeof b.declineComment === "string" ? b.declineComment.trim().slice(0, 500) : null;

  const invite = await getInvite(inviteId);
  if (!invite) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  if (invite.invitedUid !== uid) {
    return NextResponse.json({ error: "Not your invite." }, { status: 403 });
  }

  const updated = await rsvpInvite(inviteId, uid, status, declineComment);
  if (!updated) {
    return NextResponse.json({ error: "Could not update invite." }, { status: 500 });
  }

  if (status === "going" || status === "maybe") {
    await rememberTripForUser(uid, invite.tripId);
  }

  if (status === "declined") {
    const commentPart = declineComment ? `: "${declineComment}"` : ".";
    await appendTripActivity(
      invite.tripId,
      `${invite.invitedDisplayName} (@${invite.invitedUsername}) can't make it${commentPart}`
    );
  }

  return NextResponse.json({ invite: updated });
}
