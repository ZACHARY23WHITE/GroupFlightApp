"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import { CABIN_OPTIONS } from "@/lib/travel-class";
import {
  PROFILE_SESSION_EVENT,
  fetchProfile,
  getOrCreateProfileId,
  isSessionActive,
  markOnboardingDoneLocal,
  markSessionActive,
  saveProfile,
  syncOnboardingFlagFromProfile,
  type ClientProfile,
} from "@/lib/profile-client";

const inputClass =
  "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-base text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/80";

const labelClass = "text-sm font-medium text-stone-700";

async function fileToJpegDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 512;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let q = 0.88;
  let dataUrl = canvas.toDataURL("image/jpeg", q);
  while (dataUrl.length > 420_000 && q > 0.45) {
    q -= 0.07;
    dataUrl = canvas.toDataURL("image/jpeg", q);
  }
  return dataUrl;
}

function profileToForm(p: ClientProfile) {
  return {
    displayName: p.displayName,
    email: p.email,
    phone: p.phone,
    homeAirport: p.homeAirport,
    homeCity: p.homeCity,
    familyAdults: p.familyAdults,
    familyChildren: p.familyChildren,
    preferredCabin: p.preferredCabin,
    profilePhotoDataUrl: p.profilePhotoDataUrl,
    smsUpdatesOptIn: p.smsUpdatesOptIn,
  };
}

export function ProfileForm() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [serverHadOnboarding, setServerHadOnboarding] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [homeAirport, setHomeAirport] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [familyAdults, setFamilyAdults] = useState(1);
  const [familyChildren, setFamilyChildren] = useState(0);
  const [preferredCabin, setPreferredCabin] = useState("economy");
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(
    null
  );
  const [smsUpdatesOptIn, setSmsUpdatesOptIn] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const syncSession = () => setSession(isSessionActive());
    syncSession();
    window.addEventListener(PROFILE_SESSION_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    return () => {
      window.removeEventListener(PROFILE_SESSION_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!user) {
        getOrCreateProfileId();
      }
      const p = await fetchProfile();
      syncOnboardingFlagFromProfile(p);
      setSession(isSessionActive());
      if (p) {
        setServerHadOnboarding(Boolean(p.onboardingCompletedAt));
        const f = profileToForm(p);
        setDisplayName(f.displayName);
        setEmail(f.email);
        setPhone(f.phone);
        setHomeAirport(f.homeAirport);
        setHomeCity(f.homeCity);
        setFamilyAdults(f.familyAdults);
        setFamilyChildren(f.familyChildren);
        setPreferredCabin(f.preferredCabin);
        setProfilePhotoDataUrl(f.profilePhotoDataUrl);
        setSmsUpdatesOptIn(f.smsUpdatesOptIn);
      }
      setLoading(false);
    })();
  }, [authLoading, user?.uid]);

  const onPickPhoto = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    try {
      const url = await fileToJpegDataUrl(file);
      if (url.length > 480_000) {
        setError("That photo is still too large. Try another.");
        return;
      }
      setProfilePhotoDataUrl(url);
    } catch {
      setError("Could not use that image. Try a JPG or PNG.");
    }
  }, []);

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSavedAt(null);
    if (!user) {
      getOrCreateProfileId();
    }
    const result = await saveProfile({
      displayName,
      email: email.trim() || user?.email || "",
      phone,
      homeAirport,
      homeCity,
      familyAdults,
      familyChildren,
      preferredCabin,
      profilePhotoDataUrl,
      smsUpdatesOptIn,
      markOnboardingComplete: !serverHadOnboarding,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    markOnboardingDoneLocal();
    markSessionActive();
    syncOnboardingFlagFromProfile(result.profile);
    setServerHadOnboarding(true);
    setSession(true);
    setSavedAt(new Date().toLocaleTimeString([], { timeStyle: "short" }));
  }, [
    displayName,
    email,
    phone,
    homeAirport,
    homeCity,
    familyAdults,
    familyChildren,
    preferredCabin,
    profilePhotoDataUrl,
    smsUpdatesOptIn,
    serverHadOnboarding,
    user?.email,
  ]);

  if (loading) {
    return (
      <SubmitHangarOverlay open message="Loading your profile…" />
    );
  }

  return (
    <>
    <div className="relative mx-auto w-full max-w-lg px-4 pb-16 pt-8 sm:px-6">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_50%_at_50%_-15%,rgb(255_228_230/0.4),transparent)]"
        aria-hidden
      />
      <div className="relative flex flex-col gap-8">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Your account
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-source-serif)] text-3xl font-normal tracking-tight text-stone-900">
            Profile
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-stone-500">
            {user
              ? "This information pre-fills new trips and traveler rows. It is saved to your Gather account."
              : "This information pre-fills new trips and traveler rows. On this device it stays in your browser until you sign in or clear site data."}
          </p>
          {!user ? (
            <p className="mt-3 text-sm">
              <Link
                href="/login?next=%2Fprofile"
                className="font-semibold text-rose-600 underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to save your profile to your account and sync trips.
            </p>
          ) : null}
          {user || session ? (
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await signOut();
                  setSession(false);
                  router.push("/");
                })();
              }}
              className="mt-4 w-fit rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-600 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900"
            >
              {user ? "Sign out" : "Log out of this profile"}
            </button>
          ) : null}
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-stone-200 bg-white shadow-sm transition-colors hover:border-rose-200"
          >
            {profilePhotoDataUrl ? (
              <img
                src={profilePhotoDataUrl}
                alt="Your profile photo"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <span className="px-3 text-center text-xs font-medium text-stone-400">
                Add photo
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickPhoto(e.target.files)}
          />
          {profilePhotoDataUrl ? (
            <button
              type="button"
              onClick={() => setProfilePhotoDataUrl(null)}
              className="text-xs font-semibold text-stone-500 hover:text-rose-700 hover:underline"
            >
              Remove photo
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-sm sm:p-7">
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
              autoComplete="name"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Phone</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              autoComplete="tel"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Home airport (IATA)</span>
            <input
              value={homeAirport}
              onChange={(e) =>
                setHomeAirport(e.target.value.toUpperCase().slice(0, 3))
              }
              maxLength={3}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Home city (optional)</span>
            <input
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              className={inputClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Adults</span>
              <input
                type="number"
                min={1}
                max={9}
                value={familyAdults}
                onChange={(e) =>
                  setFamilyAdults(
                    Math.min(
                      9,
                      Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    )
                  )
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className={labelClass}>Children</span>
              <input
                type="number"
                min={0}
                max={8}
                value={familyChildren}
                onChange={(e) =>
                  setFamilyChildren(
                    Math.min(
                      8,
                      Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                    )
                  )
                }
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2">
            <span className={labelClass}>Preferred cabin</span>
            <select
              value={preferredCabin}
              onChange={(e) => setPreferredCabin(e.target.value)}
              className={inputClass}
            >
              {CABIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-4">
            <input
              type="checkbox"
              checked={smsUpdatesOptIn}
              onChange={(e) => setSmsUpdatesOptIn(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-stone-300 text-rose-600"
            />
            <span className="text-sm text-stone-600">
              Text me important trip updates (when available)
            </span>
          </label>
        </div>

        {error ? (
          <p
            className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {savedAt ? (
          <p className="text-center text-sm font-medium text-emerald-700">
            Saved at {savedAt}
          </p>
        ) : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void onSave()}
          className="rounded-2xl bg-rose-600 py-4 text-base font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-45"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
    <SubmitHangarOverlay open={saving} message="Saving your profile…" />
    </>
  );
}
