import * as admin from "firebase-admin";
import { getFirestoreDb } from "@/lib/firebase-server";
import { normalizeIata } from "@/lib/iata";
import { CABIN_OPTIONS } from "@/lib/travel-class";

const FieldValue = admin.firestore.FieldValue;

const profilesCollection = () => getFirestoreDb().collection("userProfiles");

const CABIN_VALUES = new Set<string>(CABIN_OPTIONS.map((o) => o.value));

export type UserProfileDto = {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  homeAirport: string;
  familyAdults: number;
  familyChildren: number;
  preferredCabin: string;
  profilePhotoDataUrl: string | null;
  smsUpdatesOptIn: boolean;
  homeCity: string;
  onboardingCompletedAt: string | null;
  updatedAt: string | null;
};

function timestampToIso(
  v: FirebaseFirestore.Timestamp | Date | string | undefined | null
): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof (v as FirebaseFirestore.Timestamp).toDate === "function") {
    return (v as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return null;
}

function profileFromDoc(
  docId: string,
  data: FirebaseFirestore.DocumentData
): UserProfileDto {
  return {
    id: docId,
    displayName: String(data.displayName ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    homeAirport: String(data.homeAirport ?? ""),
    familyAdults:
      typeof data.familyAdults === "number"
        ? Math.min(9, Math.max(1, Math.trunc(data.familyAdults)))
        : 1,
    familyChildren:
      typeof data.familyChildren === "number"
        ? Math.min(8, Math.max(0, Math.trunc(data.familyChildren)))
        : 0,
    preferredCabin:
      typeof data.preferredCabin === "string" &&
      CABIN_VALUES.has(data.preferredCabin)
        ? data.preferredCabin
        : "economy",
    profilePhotoDataUrl:
      typeof data.profilePhotoDataUrl === "string" &&
      data.profilePhotoDataUrl.length > 0
        ? data.profilePhotoDataUrl
        : null,
    smsUpdatesOptIn: Boolean(data.smsUpdatesOptIn),
    homeCity: String(data.homeCity ?? ""),
    onboardingCompletedAt: timestampToIso(data.onboardingCompletedAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

export type ProfileWriteInput = {
  displayName: string;
  email: string;
  phone: string;
  homeAirport: string;
  familyAdults: number;
  familyChildren: number;
  preferredCabin: string;
  profilePhotoDataUrl: string | null;
  smsUpdatesOptIn: boolean;
  homeCity: string;
  markOnboardingComplete: boolean;
};

const MAX_PHOTO_CHARS = 550_000;

export function validateProfileWrite(
  input: ProfileWriteInput
): { ok: true } | { ok: false; error: string } {
  const name = input.displayName.trim();
  if (!name || name.length > 80) {
    return { ok: false, error: "Name is required (max 80 characters)." };
  }
  const email = input.email.trim();
  if (email.length > 120) {
    return { ok: false, error: "Email is too long." };
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  const phone = input.phone.trim();
  if (phone.length > 40) {
    return { ok: false, error: "Phone number is too long." };
  }
  const iata = normalizeIata(input.homeAirport);
  if (!iata) {
    return {
      ok: false,
      error: "Home airport must be a 3-letter IATA code (e.g. SEA, ATL).",
    };
  }
  if (!CABIN_VALUES.has(input.preferredCabin)) {
    return { ok: false, error: "Invalid cabin class." };
  }
  if (
    input.profilePhotoDataUrl != null &&
    input.profilePhotoDataUrl.length > MAX_PHOTO_CHARS
  ) {
    return {
      ok: false,
      error: "Profile photo is too large. Try a smaller image.",
    };
  }
  const city = input.homeCity.trim();
  if (city.length > 80) {
    return { ok: false, error: "Home city is too long." };
  }
  return { ok: true };
}

export async function getUserProfile(
  profileId: string
): Promise<UserProfileDto | null> {
  const doc = await profilesCollection().doc(profileId).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data) return null;
  return profileFromDoc(doc.id, data);
}

/**
 * Move a pre-auth Firestore profile (random id) onto the user’s Firebase uid.
 * If uid already has a profile, only deletes the legacy doc.
 */
export async function migrateLegacyProfileToUid(
  legacyProfileId: string,
  uid: string
): Promise<UserProfileDto | null> {
  const col = profilesCollection();
  const legacyRef = col.doc(legacyProfileId);
  const legacySnap = await legacyRef.get();
  if (!legacySnap.exists) return null;

  const targetRef = col.doc(uid);
  const targetSnap = await targetRef.get();
  const legacyData = legacySnap.data();
  if (!legacyData) return null;

  if (targetSnap.exists) {
    await legacyRef.delete();
    const data = targetSnap.data();
    if (!data) return null;
    return profileFromDoc(uid, data);
  }

  await targetRef.set(legacyData, { merge: false });
  await legacyRef.delete();
  const after = await targetRef.get();
  const ad = after.data();
  if (!ad) return null;
  return profileFromDoc(uid, ad);
}

export async function upsertUserProfile(
  profileId: string,
  input: ProfileWriteInput
): Promise<UserProfileDto> {
  const validated = validateProfileWrite(input);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  const iata = normalizeIata(input.homeAirport)!;
  const ref = profilesCollection().doc(profileId);
  const payload: Record<string, unknown> = {
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    homeAirport: iata,
    familyAdults: Math.min(9, Math.max(1, Math.trunc(input.familyAdults))),
    familyChildren: Math.min(8, Math.max(0, Math.trunc(input.familyChildren))),
    preferredCabin: input.preferredCabin,
    profilePhotoDataUrl: input.profilePhotoDataUrl,
    smsUpdatesOptIn: input.smsUpdatesOptIn,
    homeCity: input.homeCity.trim(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (input.markOnboardingComplete) {
    payload.onboardingCompletedAt = FieldValue.serverTimestamp();
  }

  const snap = await ref.get();
  if (!snap.exists) {
    payload.createdAt = FieldValue.serverTimestamp();
  }

  await ref.set(payload, { merge: true });

  const after = await ref.get();
  const data = after.data();
  if (!data) throw new Error("Profile write failed.");
  return profileFromDoc(after.id, data);
}
