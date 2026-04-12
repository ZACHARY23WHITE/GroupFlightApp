import * as admin from "firebase-admin";
import { nanoid } from "nanoid";
import { getFirestoreDb } from "@/lib/firebase-server";
import { generateShareCode } from "@/lib/share-code";

const FieldValue = admin.firestore.FieldValue;

const tripsCollection = () => getFirestoreDb().collection("trips");

export type TravelerDto = {
  id: string;
  displayName: string;
  homeAirport: string;
  adults: number;
  children: number;
  cabinClass: string;
};

export type TripDto = {
  id: string;
  name: string;
  shareCode: string;
  travelers: TravelerDto[];
};

function travelerFromDoc(
  docId: string,
  data: FirebaseFirestore.DocumentData
): TravelerDto {
  return {
    id: docId,
    displayName: String(data.displayName ?? ""),
    homeAirport: String(data.homeAirport ?? ""),
    adults: typeof data.adults === "number" ? data.adults : 1,
    children: typeof data.children === "number" ? data.children : 0,
    cabinClass:
      typeof data.cabinClass === "string" ? data.cabinClass : "economy",
  };
}

async function listTravelersOrdered(tripId: string): Promise<TravelerDto[]> {
  const snap = await tripsCollection()
    .doc(tripId)
    .collection("travelers")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((d) => travelerFromDoc(d.id, d.data()));
}

export async function tripExists(tripId: string): Promise<boolean> {
  const doc = await tripsCollection().doc(tripId).get();
  return doc.exists;
}

export async function getTripWithTravelers(
  tripId: string
): Promise<TripDto | null> {
  const doc = await tripsCollection().doc(tripId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  const travelers = await listTravelersOrdered(tripId);
  return {
    id: doc.id,
    name: String(data.name ?? ""),
    shareCode: String(data.shareCode ?? ""),
    travelers,
  };
}

export async function getTripIdByShareCode(
  shareCode: string
): Promise<string | null> {
  const q = await tripsCollection()
    .where("shareCode", "==", shareCode)
    .limit(1)
    .get();
  if (q.empty) return null;
  return q.docs[0].id;
}

export async function createTrip(
  name: string
): Promise<{ id: string; shareCode: string }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const shareCode = generateShareCode();
    const collision = await getTripIdByShareCode(shareCode);
    if (collision) continue;

    const id = nanoid();
    // Don’t swallow Firestore errors — a failed write retried 8× looked like “share code” issues.
    await tripsCollection().doc(id).set({
      name,
      shareCode,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id, shareCode };
  }
  throw new Error("Could not allocate a share code. Try again.");
}

export async function updateTripName(
  tripId: string,
  name: string
): Promise<TripDto | null> {
  const ref = tripsCollection().doc(tripId);
  const doc = await ref.get();
  if (!doc.exists) return null;
  await ref.update({ name });
  return getTripWithTravelers(tripId);
}

export async function createTraveler(
  tripId: string,
  params: {
    displayName: string;
    homeAirport: string;
    adults: number;
    children: number;
    cabinClass: string;
  }
): Promise<TravelerDto> {
  const id = nanoid();
  await tripsCollection()
    .doc(tripId)
    .collection("travelers")
    .doc(id)
    .set({
      displayName: params.displayName,
      homeAirport: params.homeAirport,
      adults: params.adults,
      children: params.children,
      cabinClass: params.cabinClass,
      createdAt: FieldValue.serverTimestamp(),
    });
  return {
    id,
    displayName: params.displayName,
    homeAirport: params.homeAirport,
    adults: params.adults,
    children: params.children,
    cabinClass: params.cabinClass,
  };
}

export async function deleteTraveler(
  tripId: string,
  travelerId: string
): Promise<boolean> {
  const ref = tripsCollection()
    .doc(tripId)
    .collection("travelers")
    .doc(travelerId);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.delete();
  return true;
}
