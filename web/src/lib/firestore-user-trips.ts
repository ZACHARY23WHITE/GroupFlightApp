import * as admin from "firebase-admin";
import { getFirestoreDb } from "@/lib/firebase-server";
import { getTripMeta } from "@/lib/firestore-trips";

const FieldValue = admin.firestore.FieldValue;

function userTripsCollection(uid: string) {
  return getFirestoreDb().collection("users").doc(uid).collection("trips");
}

export type UserTripSummary = {
  id: string;
  name: string;
  shareCode: string;
  lastOpenedAt: string | null;
};

/** Upsert a row under `users/{uid}/trips/{tripId}` so the home screen can list trips. */
export async function rememberTripForUser(
  uid: string,
  tripId: string
): Promise<boolean> {
  const meta = await getTripMeta(tripId);
  if (!meta) return false;
  await userTripsCollection(uid)
    .doc(tripId)
    .set(
      {
        tripId,
        name: meta.name,
        shareCode: meta.shareCode,
        lastOpenedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  return true;
}

export async function listTripsForUser(
  uid: string
): Promise<UserTripSummary[]> {
  const snap = await userTripsCollection(uid)
    .orderBy("lastOpenedAt", "desc")
    .limit(50)
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    const ts = data.lastOpenedAt as { toDate?: () => Date } | undefined;
    const lastOpenedAt =
      ts && typeof ts.toDate === "function"
        ? ts.toDate().toISOString()
        : null;
    return {
      id: d.id,
      name: String(data.name ?? ""),
      shareCode: String(data.shareCode ?? ""),
      lastOpenedAt,
    };
  });
}
