"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  PROFILE_SESSION_EVENT,
  dismissOnboardingPrompt,
  fetchProfile,
  isOnboardingPromptDismissed,
  isSessionActive,
} from "@/lib/profile-client";
import {
  MY_TRIPS_UPDATED_EVENT,
  fetchMyTrips,
  type MyTripSummary,
} from "@/lib/trips-client";

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [showOnboardingCue, setShowOnboardingCue] = useState(false);
  const [myTrips, setMyTrips] = useState<MyTripSummary[]>([]);
  const [myTripsLoading, setMyTripsLoading] = useState(false);

  const loadMyTrips = useCallback(async () => {
    if (!user) {
      setMyTrips([]);
      return;
    }
    setMyTripsLoading(true);
    try {
      const list = await fetchMyTrips();
      setMyTrips(list ?? []);
    } finally {
      setMyTripsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMyTrips();
  }, [loadMyTrips]);

  useEffect(() => {
    const onUpdate = () => void loadMyTrips();
    window.addEventListener(MY_TRIPS_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(MY_TRIPS_UPDATED_EVENT, onUpdate);
  }, [loadMyTrips]);

  useEffect(() => {
    let cancelled = false;
    const refreshCue = () => {
      void (async () => {
        if (authLoading) return;
        if (!user) {
          if (cancelled) return;
          setShowOnboardingCue(
            !isSessionActive() && !isOnboardingPromptDismissed()
          );
          return;
        }
        const p = await fetchProfile();
        if (cancelled) return;
        const incomplete = !p?.onboardingCompletedAt;
        setShowOnboardingCue(
          incomplete && !isOnboardingPromptDismissed()
        );
      })();
    };
    refreshCue();
    window.addEventListener(PROFILE_SESSION_EVENT, refreshCue);
    window.addEventListener("storage", refreshCue);
    return () => {
      cancelled = true;
      window.removeEventListener(PROFILE_SESSION_EVENT, refreshCue);
      window.removeEventListener("storage", refreshCue);
    };
  }, [authLoading, user]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-15%,rgb(255_228_230/0.45),transparent)]"
        aria-hidden
      />
      <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-2 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Gather
          </p>
          <h1 className="font-[family-name:var(--font-source-serif)] text-2xl font-normal tracking-tight text-stone-900 sm:text-[1.75rem]">
            Your trips
          </h1>
          <p className="text-sm leading-relaxed text-stone-500">
            Tap{" "}
            <span className="font-semibold text-stone-700">+</span> below to
            create a trip or join with an invite code.
          </p>
        </div>

        {!authLoading && !user ? (
          <p className="rounded-xl border border-stone-200/90 bg-white/80 px-4 py-3 text-center text-sm leading-relaxed text-stone-600 shadow-sm sm:text-left">
            <Link
              href="/login?next=%2F"
              className="font-semibold text-rose-600 underline-offset-2 hover:underline"
            >
              Sign in
            </Link>{" "}
            to sync trips across devices. You can still use{" "}
            <span className="font-semibold text-stone-800">+</span> as a guest.
          </p>
        ) : null}

        {showOnboardingCue ? (
          <section className="relative overflow-hidden rounded-2xl border border-rose-100/90 bg-gradient-to-br from-white via-rose-50/40 to-white p-5 shadow-[0_8px_40px_rgb(225_29_72/0.08)] sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-200/35 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700/80">
                Personalize
              </p>
              <h2 className="font-[family-name:var(--font-source-serif)] text-lg font-normal leading-snug text-stone-900">
                {user
                  ? "Finish your travel profile"
                  : "Set up your profile in about a minute"}
              </h2>
              <p className="text-sm leading-relaxed text-stone-600">
                We&apos;ll remember your home airport and household so joining a
                trip is one tap.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
                >
                  {user ? "Continue setup" : "Start setup"}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    dismissOnboardingPrompt();
                    setShowOnboardingCue(false);
                  }}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-500 underline-offset-4 hover:text-stone-700 hover:underline"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(15_15_15/0.04),0_4px_24px_rgb(15_15_15/0.03)] sm:p-6">
          {user ? (
            <>
              {myTripsLoading ? (
                <p className="text-sm text-stone-500">Loading your trips…</p>
              ) : myTrips.length === 0 ? (
                <p className="text-sm leading-relaxed text-stone-600">
                  No trips yet. Use the{" "}
                  <span className="font-semibold text-stone-800">+</span>{" "}
                  button to create one or join with a code.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {myTrips.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/trip/${t.id}`}
                        className="flex flex-col rounded-xl border border-stone-200/90 bg-stone-50/50 px-4 py-3 transition-colors hover:border-rose-200 hover:bg-rose-50/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-semibold text-stone-900">
                          {t.name.trim() || "Untitled trip"}
                        </span>
                        <span className="font-mono text-xs tracking-wider text-stone-500 sm:text-right">
                          {t.shareCode}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-stone-600">
              After you sign in, trips you create or join will appear here.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
