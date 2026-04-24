"use client";

import { getFirebaseAuth } from "@/lib/firebase-client";
import { getOrCreateProfileId } from "@/lib/profile-client";

export const MY_TRIPS_UPDATED_EVENT = "gtp-my-trips-updated";

export function notifyMyTripsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MY_TRIPS_UPDATED_EVENT));
}

export type MyTripSummary = {
  id: string;
  name: string;
  shareCode: string;
};

async function bearerHeaders(): Promise<Record<string, string> | null> {
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (!u) return null;
  try {
    const t = await u.getIdToken();
    return { Authorization: `Bearer ${t}` };
  } catch {
    return null;
  }
}

/** JSON POST/PATCH headers; includes Bearer when a user is signed in. */
export async function jsonHeadersWithOptionalAuth(): Promise<
  Record<string, string>
> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const b = await bearerHeaders();
  if (b?.Authorization) h.Authorization = b.Authorization;
  return h;
}

/** Auth for trip chat / votes: Bearer when signed in, else guest `X-Profile-Id`. */
export async function collabRequestHeaders(): Promise<
  Record<string, string>
> {
  const h: Record<string, string> = {};
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (u) {
    try {
      const t = await u.getIdToken();
      h.Authorization = `Bearer ${t}`;
    } catch {
      /* ignore */
    }
  } else {
    const id = getOrCreateProfileId();
    if (id) h["X-Profile-Id"] = id;
  }
  return h;
}

export async function collabJsonHeaders(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    ...(await collabRequestHeaders()),
  };
}

/** Saves this trip for the signed-in user (Firestore `users/{uid}/trips/{tripId}`). */
export async function rememberTripClient(tripId: string): Promise<boolean> {
  const h = await bearerHeaders();
  if (!h) return false;
  const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/remember`, {
    method: "POST",
    headers: h,
  });
  return res.ok;
}

/** Trips linked to the current Firebase user, most recent first. */
export async function fetchMyTrips(): Promise<MyTripSummary[] | null> {
  const h = await bearerHeaders();
  if (!h) return [];
  const res = await fetch("/api/trips/mine", { headers: h });
  if (!res.ok) return null;
  const j = (await res.json()) as { trips?: MyTripSummary[] };
  return j.trips ?? [];
}
