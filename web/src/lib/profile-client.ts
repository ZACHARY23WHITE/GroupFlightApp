"use client";

import { getFirebaseAuth } from "@/lib/firebase-client";

export const PROFILE_ID_KEY = "gtp_profile_id";
export const ONBOARDING_DONE_KEY = "gtp_onboarding_done";
export const ONBOARDING_DISMISS_KEY = "gtp_onboarding_prompt_dismissed";
/** Set when onboarding or profile save completes — guest / legacy session. */
export const SESSION_ACTIVE_KEY = "gtp_session_active";

export const PROFILE_SESSION_EVENT = "gtp-profile-session";

export function dispatchSessionChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_SESSION_EVENT));
}

export function markSessionActive(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_ACTIVE_KEY, "1");
  dispatchSessionChange();
}

/** Guest / legacy session only — pair with useAuth().user for full “signed in” state. */
export function isSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  if (localStorage.getItem(SESSION_ACTIVE_KEY) === "1") return true;
  if (
    localStorage.getItem(ONBOARDING_DONE_KEY) === "1" &&
    localStorage.getItem(PROFILE_ID_KEY)
  ) {
    return true;
  }
  return false;
}

/** Clear local guest keys (Firebase signOut is separate — use AuthProvider.signOut). */
export function signOutProfile(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_ID_KEY);
  localStorage.removeItem(ONBOARDING_DONE_KEY);
  localStorage.removeItem(ONBOARDING_DISMISS_KEY);
  localStorage.removeItem(SESSION_ACTIVE_KEY);
  dispatchSessionChange();
}

export function getProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(PROFILE_ID_KEY);
}

export function getOrCreateProfileId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(PROFILE_ID_KEY);
  if (!id || !/^[a-zA-Z0-9_-]{8,128}$/.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(PROFILE_ID_KEY, id);
  }
  return id;
}

export function markOnboardingDoneLocal(): void {
  localStorage.setItem(ONBOARDING_DONE_KEY, "1");
}

export function isOnboardingDoneLocal(): boolean {
  return localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
}

export function dismissOnboardingPrompt(): void {
  localStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
}

export function isOnboardingPromptDismissed(): boolean {
  return localStorage.getItem(ONBOARDING_DISMISS_KEY) === "1";
}

export type ClientProfile = {
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

/** Headers for GET/PUT /api/profile — Firebase Bearer first, else guest X-Profile-Id. */
export async function getProfileRequestHeaders(): Promise<Record<
  string,
  string
> | null> {
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (u) {
    try {
      const t = await u.getIdToken();
      return { Authorization: `Bearer ${t}` };
    } catch {
      return null;
    }
  }
  const id = getProfileId();
  if (id) return { "X-Profile-Id": id };
  return null;
}

export async function fetchProfile(): Promise<ClientProfile | null> {
  const headers = await getProfileRequestHeaders();
  if (!headers) return null;
  const res = await fetch("/api/profile", { headers });
  if (!res.ok) return null;
  const j = (await res.json()) as { profile: ClientProfile | null };
  return j.profile ?? null;
}

export async function saveProfile(
  body: Record<string, unknown>
): Promise<{ ok: true; profile: ClientProfile } | { ok: false; error: string }> {
  const headers = await getProfileRequestHeaders();
  if (!headers) {
    return { ok: false, error: "Sign in or open Profile once to use this device." };
  }
  const res = await fetch("/api/profile", {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let j: { profile?: ClientProfile; error?: string };
  try {
    j = (await res.json()) as typeof j;
  } catch {
    return { ok: false, error: "Invalid response from server." };
  }
  if (!res.ok) {
    return { ok: false, error: j.error ?? "Could not save profile." };
  }
  if (!j.profile) {
    return { ok: false, error: "Could not save profile." };
  }
  return { ok: true, profile: j.profile };
}

export function syncOnboardingFlagFromProfile(
  profile: ClientProfile | null
): void {
  if (profile?.onboardingCompletedAt) {
    markOnboardingDoneLocal();
    markSessionActive();
  }
}
