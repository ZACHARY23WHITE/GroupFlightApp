import * as admin from "firebase-admin";
import { nanoid } from "nanoid";
import { getFirestoreDb } from "@/lib/firebase-server";

const FieldValue = admin.firestore.FieldValue;

const invitesCollection = () => getFirestoreDb().collection("tripInvites");

export type InviteStatus = "pending" | "going" | "maybe" | "declined";

export type TripInviteDto = {
  id: string;
  tripId: string;
  tripName: string;
  tripShareCode: string;
  tripPurpose: string;
  tripDateEarliest: string;
  tripDateLatest: string;
  invitedByUid: string;
  invitedByName: string;
  invitedUid: string;
  invitedUsername: string;
  invitedDisplayName: string;
  status: InviteStatus;
  declineComment: string | null;
  createdAt: string | null;
  respondedAt: string | null;
};

function tsIso(v: FirebaseFirestore.Timestamp | null | undefined): string | null {
  if (!v) return null;
  if (typeof (v as FirebaseFirestore.Timestamp).toDate === "function") {
    return (v as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return null;
}

function inviteFromDoc(
  id: string,
  d: FirebaseFirestore.DocumentData
): TripInviteDto {
  return {
    id,
    tripId: String(d.tripId ?? ""),
    tripName: String(d.tripName ?? ""),
    tripShareCode: String(d.tripShareCode ?? ""),
    tripPurpose: String(d.tripPurpose ?? ""),
    tripDateEarliest: String(d.tripDateEarliest ?? ""),
    tripDateLatest: String(d.tripDateLatest ?? ""),
    invitedByUid: String(d.invitedByUid ?? ""),
    invitedByName: String(d.invitedByName ?? ""),
    invitedUid: String(d.invitedUid ?? ""),
    invitedUsername: String(d.invitedUsername ?? ""),
    invitedDisplayName: String(d.invitedDisplayName ?? ""),
    status: (["pending","going","maybe","declined"].includes(d.status) ? d.status : "pending") as InviteStatus,
    declineComment: typeof d.declineComment === "string" ? d.declineComment : null,
    createdAt: tsIso(d.createdAt),
    respondedAt: tsIso(d.respondedAt),
  };
}

export async function createTripInvite(params: {
  tripId: string;
  tripName: string;
  tripShareCode: string;
  tripPurpose: string;
  tripDateEarliest: string;
  tripDateLatest: string;
  invitedByUid: string;
  invitedByName: string;
  invitedUid: string;
  invitedUsername: string;
  invitedDisplayName: string;
}): Promise<TripInviteDto> {
  // Don't allow duplicate pending invites for the same trip+user
  const existing = await invitesCollection()
    .where("tripId", "==", params.tripId)
    .where("invitedUid", "==", params.invitedUid)
    .where("status", "==", "pending")
    .limit(1)
    .get();
  if (!existing.empty) {
    return inviteFromDoc(existing.docs[0].id, existing.docs[0].data());
  }

  const id = nanoid();
  await invitesCollection().doc(id).set({
    ...params,
    status: "pending",
    declineComment: null,
    createdAt: FieldValue.serverTimestamp(),
    respondedAt: null,
  });
  return {
    ...params,
    id,
    status: "pending",
    declineComment: null,
    createdAt: new Date().toISOString(),
    respondedAt: null,
  };
}

export async function listInvitesForTrip(tripId: string): Promise<TripInviteDto[]> {
  const snap = await invitesCollection()
    .where("tripId", "==", tripId)
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => inviteFromDoc(d.id, d.data()));
}

export async function listPendingInvitesForUser(uid: string): Promise<TripInviteDto[]> {
  const snap = await invitesCollection()
    .where("invitedUid", "==", uid)
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => inviteFromDoc(d.id, d.data()));
}

export async function getInvite(inviteId: string): Promise<TripInviteDto | null> {
  const doc = await invitesCollection().doc(inviteId).get();
  if (!doc.exists) return null;
  const d = doc.data();
  if (!d) return null;
  return inviteFromDoc(doc.id, d);
}

export async function rsvpInvite(
  inviteId: string,
  uid: string,
  status: "going" | "maybe" | "declined",
  declineComment: string | null
): Promise<TripInviteDto | null> {
  const ref = invitesCollection().doc(inviteId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  const d = doc.data();
  if (!d || d.invitedUid !== uid) return null;

  await ref.update({
    status,
    declineComment: declineComment ?? null,
    respondedAt: FieldValue.serverTimestamp(),
  });

  const after = await ref.get();
  const ad = after.data();
  if (!ad) return null;
  return inviteFromDoc(inviteId, ad);
}
