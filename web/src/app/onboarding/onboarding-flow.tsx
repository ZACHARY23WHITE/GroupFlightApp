"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import { CABIN_OPTIONS } from "@/lib/travel-class";
import {
  dismissOnboardingPrompt,
  fetchProfile,
  markOnboardingDoneLocal,
  markSessionActive,
  saveProfile,
} from "@/lib/profile-client";

const inputClass =
  "w-full rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-base text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/80";

const labelClass = "text-sm font-medium text-stone-700";

const STEP_COUNT = 5;

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

export function OnboardingFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return")?.trim() || "/";
  const { user, loading: authLoading } = useAuth();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(
    null
  );
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsUpdatesOptIn, setSmsUpdatesOptIn] = useState(false);
  const [homeAirport, setHomeAirport] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [familyAdults, setFamilyAdults] = useState(2);
  const [familyChildren, setFamilyChildren] = useState(0);
  const [preferredCabin, setPreferredCabin] = useState("economy");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(
        `/login?next=${encodeURIComponent("/onboarding")}`
      );
      return;
    }
    void (async () => {
      const p = await fetchProfile();
      if (p?.onboardingCompletedAt) {
        router.replace("/");
      }
    })();
  }, [authLoading, user, router]);

  const progress = useMemo(
    () => Math.round(((step + 1) / STEP_COUNT) * 100),
    [step]
  );

  const goNext = useCallback(() => {
    setError(null);
    setStep((s) => Math.min(STEP_COUNT - 1, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const onPickPhoto = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setError(null);
    try {
      const url = await fileToJpegDataUrl(file);
      if (url.length > 480_000) {
        setError("That photo is still too large after compressing. Try another.");
        return;
      }
      setProfilePhotoDataUrl(url);
    } catch {
      setError("Could not use that image. Try a JPG or PNG.");
    }
  }, []);

  const finish = useCallback(async () => {
    setBusy(true);
    setError(null);
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
      markOnboardingComplete: true,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setStep(4);
      return;
    }
    markOnboardingDoneLocal();
    markSessionActive();
    dismissOnboardingPrompt();
    router.push(returnTo.startsWith("/") ? returnTo : "/");
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
    router,
    returnTo,
    user?.email,
  ]);

  const validateStep = useCallback((): boolean => {
    if (step === 1) {
      const n = displayName.trim();
      if (!n) {
        setError("Add your name so your group knows who you are.");
        return false;
      }
    }
    if (step === 3) {
      const code = homeAirport.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        setError("Home airport should be a 3-letter code like SEA or ATL.");
        return false;
      }
    }
    return true;
  }, [step, displayName, homeAirport]);

  const onPrimary = useCallback(() => {
    setError(null);
    if (step === 0) {
      goNext();
      return;
    }
    if (step === 1 || step === 3) {
      if (!validateStep()) return;
      goNext();
      return;
    }
    if (step === 2) {
      goNext();
      return;
    }
    if (step === 4) {
      void finish();
    }
  }, [step, validateStep, goNext, finish]);

  if (authLoading || !user) {
    return (
      <SubmitHangarOverlay
        open
        message={
          authLoading ? "Loading…" : "Redirecting to sign in…"
        }
      />
    );
  }

  return (
    <>
    <div className="relative flex min-h-[100dvh] flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgb(255_228_230/0.55),transparent),radial-gradient(ellipse_70%_40%_at_100%_50%,rgb(254_242_242/0.35),transparent)]"
        aria-hidden
      />

      <div className="absolute right-3 top-3 z-20 sm:right-5 sm:top-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200/90 bg-white/90 text-stone-500 shadow-sm backdrop-blur-sm transition-colors hover:border-stone-300 hover:bg-white hover:text-stone-800"
          aria-label="Close and return home"
        >
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        </button>
      </div>

      <div className="relative flex flex-1 flex-col px-4 pb-10 pt-14 sm:px-6 sm:pt-16">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
          <div className="mb-8 flex items-center gap-3">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums text-stone-400">
              {step + 1}/{STEP_COUNT}
            </span>
          </div>

          <div
            className="flex flex-1 flex-col transition-opacity duration-300"
            key={step}
          >
            {step === 0 ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600/90">
                  Welcome
                </p>
                <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[2rem] font-normal leading-[1.15] tracking-tight text-stone-900">
                  Let&apos;s personalize your trips
                </h1>
                <p className="mt-4 text-base leading-[1.65] text-stone-500">
                  A few quick details help us pre-fill flights for your
                  household, keep invites organized, and make the app feel like
                  yours—similar to how the best travel apps start with you.
                </p>
                <ul className="mt-8 flex flex-col gap-4 text-sm text-stone-600">
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                      1
                    </span>
                    <span>
                      <strong className="font-semibold text-stone-800">
                        You
                      </strong>
                      — name and optional photo
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                      2
                    </span>
                    <span>
                      <strong className="font-semibold text-stone-800">
                        Contact
                      </strong>
                      — email and phone for trip updates
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-700">
                      3
                    </span>
                    <span>
                      <strong className="font-semibold text-stone-800">
                        Defaults
                      </strong>
                      — home airport, party size, cabin
                    </span>
                  </li>
                </ul>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                  About you
                </p>
                <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[1.75rem] font-normal leading-tight text-stone-900">
                  Who&apos;s planning?
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  This is how you&apos;ll appear when you join a shared trip.
                </p>

                <div className="mt-8 flex flex-col items-center gap-6">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="group relative flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-stone-200 bg-white shadow-sm transition-colors hover:border-rose-200 hover:bg-rose-50/30"
                  >
                    {profilePhotoDataUrl ? (
                      <img
                        src={profilePhotoDataUrl}
                        alt="Your profile preview"
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      <span className="px-4 text-center text-xs font-medium text-stone-400 group-hover:text-stone-600">
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
                      className="text-xs font-semibold text-stone-500 underline-offset-4 hover:text-rose-700 hover:underline"
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>

                <label className="mt-2 flex flex-col gap-2">
                  <span className={labelClass}>Your name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Alex Rivera"
                    autoComplete="name"
                    className={inputClass}
                  />
                </label>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                  Stay in the loop
                </p>
                <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[1.75rem] font-normal leading-tight text-stone-900">
                  How can we reach you?
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  Optional for now, but helps when we add reminders and shared
                  invites. We won&apos;t sell your info.
                </p>

                <label className="mt-8 flex flex-col gap-2">
                  <span className={labelClass}>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputClass}
                  />
                </label>
                <label className="mt-5 flex flex-col gap-2">
                  <span className={labelClass}>Phone</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 · · · · · · · · · ·"
                    autoComplete="tel"
                    className={inputClass}
                  />
                </label>

                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-stone-200/90 bg-white/80 p-4 shadow-sm">
                  <input
                    type="checkbox"
                    checked={smsUpdatesOptIn}
                    onChange={(e) => setSmsUpdatesOptIn(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-stone-300 text-rose-600 focus:ring-rose-200"
                  />
                  <span className="text-sm leading-relaxed text-stone-600">
                    <span className="font-semibold text-stone-800">
                      Text me important trip updates
                    </span>
                    <span className="block text-stone-500">
                      When SMS is available, we&apos;ll only message about trips
                      you&apos;re in.
                    </span>
                  </span>
                </label>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                  Travel defaults
                </p>
                <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[1.75rem] font-normal leading-tight text-stone-900">
                  Where do you usually fly from?
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  We&apos;ll suggest this airport when you add yourself to a
                  trip. Party size sets default adults and children for flight
                  quotes.
                </p>

                <label className="mt-8 flex flex-col gap-2">
                  <span className={labelClass}>Home airport (IATA)</span>
                  <input
                    value={homeAirport}
                    onChange={(e) =>
                      setHomeAirport(e.target.value.toUpperCase().slice(0, 3))
                    }
                    placeholder="SEA"
                    autoComplete="off"
                    className={`${inputClass} font-mono tracking-[0.12em]`}
                    maxLength={3}
                  />
                </label>

                <label className="mt-5 flex flex-col gap-2">
                  <span className={labelClass}>Home city (optional)</span>
                  <input
                    value={homeCity}
                    onChange={(e) => setHomeCity(e.target.value)}
                    placeholder="Seattle"
                    autoComplete="address-level2"
                    className={inputClass}
                  />
                </label>

                <div className="mt-5 grid grid-cols-2 gap-4">
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
                            Math.max(
                              1,
                              Number.parseInt(e.target.value, 10) || 1
                            )
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
                            Math.max(
                              0,
                              Number.parseInt(e.target.value, 10) || 0
                            )
                          )
                        )
                      }
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="mt-5 flex flex-col gap-2">
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
              </>
            ) : null}

            {step === 4 ? (
              <>
                <section className="mx-auto w-full max-w-sm pt-2 text-center">
                  <h2 className="text-base font-semibold leading-snug text-stone-900">
                    Does all this look right?
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">
                    Thank you! Here&apos;s a quick recap—you can edit anything
                    later in Profile.
                  </p>
                </section>

                <p className="mt-8 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/90">
                  You&apos;re set
                </p>
                <h1 className="mt-3 font-[family-name:var(--font-source-serif)] text-[1.75rem] font-normal leading-tight text-stone-900">
                  Here&apos;s what we&apos;ll use
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-stone-500">
                  You can change any of this anytime from your profile.
                </p>

                <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_8px_40px_rgb(15_15_15/0.05)]">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100 ring-2 ring-white">
                      {profilePhotoDataUrl ? (
                        <img
                          src={profilePhotoDataUrl}
                          alt="Your profile preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-semibold text-stone-400">
                          {displayName.trim().slice(0, 1).toUpperCase() || "?"}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-stone-900">
                        {displayName.trim() || "Your name"}
                      </p>
                      <p className="text-sm text-stone-500">
                        {email.trim() || "No email yet"}
                        {phone.trim() ? ` · ${phone.trim()}` : ""}
                      </p>
                    </div>
                  </div>
                  <dl className="grid gap-3 border-t border-stone-100 pt-4 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Home airport</dt>
                      <dd className="font-mono font-semibold text-stone-900">
                        {homeAirport.trim().toUpperCase() || "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Household</dt>
                      <dd className="text-right font-medium text-stone-900">
                        {familyAdults} adult{familyAdults !== 1 ? "s" : ""}
                        {familyChildren > 0
                          ? `, ${familyChildren} child${familyChildren !== 1 ? "ren" : ""}`
                          : ""}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-stone-500">Cabin</dt>
                      <dd className="text-right font-medium text-stone-900">
                        {CABIN_OPTIONS.find((o) => o.value === preferredCabin)
                          ?.label ?? "Economy"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </>
            ) : null}
          </div>

          {error ? (
            <p
              className="mt-6 rounded-2xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="mt-auto flex flex-col gap-3 pt-10">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onPrimary()}
              className="w-full rounded-2xl bg-rose-600 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
            >
              {step === 0
                ? "Continue"
                : step === 4
                  ? busy
                    ? "Saving…"
                    : "Save & enter app"
                  : "Next"}
            </button>
            {step > 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={goBack}
                className="w-full rounded-2xl border border-stone-200 bg-white py-3.5 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:border-stone-300 disabled:opacity-45"
              >
                Back
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
    <SubmitHangarOverlay
      open={busy}
      message="Saving your profile…"
    />
    </>
  );
}
