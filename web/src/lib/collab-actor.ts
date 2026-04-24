import * as admin from "firebase-admin";
import { getUserProfile } from "@/lib/firestore-profiles";
import { verifyBearerUid } from "@/lib/verify-bearer";

export type CollabActor = {
  /** Stable id for votes: Firebase uid, or `guest:<profileId>`. */
  key: string;
  displayName: string;
};

function profileIdFromLegacyHeader(req: Request): string | null {
  const header = req.headers.get("x-profile-id")?.trim();
  if (header && /^[a-zA-Z0-9_-]{8,128}$/.test(header)) return header;
  return null;
}

/** Optional viewer for read APIs (e.g. which proposals you voted on). */
export async function optionalCollabViewerKey(
  req: Request
): Promise<string | null> {
  const uid = await verifyBearerUid(req);
  if (uid) return uid;
  const legacy = profileIdFromLegacyHeader(req);
  if (legacy) return `guest:${legacy}`;
  return null;
}

export async function resolveCollabActor(req: Request): Promise<
  | { ok: true; actor: CollabActor }
  | { ok: false; error: string; status: number }
> {
  const uid = await verifyBearerUid(req);
  if (uid) {
    const profile = await getUserProfile(uid);
    let displayName = profile?.displayName?.trim() ?? "";
    if (!displayName) {
      try {
        const u = await admin.auth().getUser(uid);
        displayName = u.displayName?.trim() ?? "";
      } catch {
        displayName = "";
      }
    }
    if (!displayName) displayName = "Member";
    return { ok: true, actor: { key: uid, displayName } };
  }

  const legacy = profileIdFromLegacyHeader(req);
  if (legacy) {
    const profile = await getUserProfile(legacy);
    const displayName = profile?.displayName?.trim() || "Guest";
    return { ok: true, actor: { key: `guest:${legacy}`, displayName } };
  }

  return {
    ok: false,
    error:
      "Sign in, or pass X-Profile-Id (guest profile on this device) to post in the trip.",
    status: 401,
  };
}
