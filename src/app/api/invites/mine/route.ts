import { NextResponse } from "next/server";
import { verifyBearerUid } from "@/lib/verify-bearer";
import { listPendingInvitesForUser } from "@/lib/firestore-invites";

export async function GET(req: Request) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const invites = await listPendingInvitesForUser(uid);
  return NextResponse.json({ invites });
}
