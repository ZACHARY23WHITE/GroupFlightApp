"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Pip } from "@/components/pip";
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
  forgetTripClient,
  notifyMyTripsUpdated,
  type MyTripSummary,
} from "@/lib/trips-client";
import { getFirebaseAuth } from "@/lib/firebase-client";

type PendingInvite = {
  id: string;
  tripId: string;
  tripName: string;
  invitedByName: string;
  invitedByUid: string;
};

async function fetchPendingInvites(): Promise<PendingInvite[]> {
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (!u) return [];
  try {
    const token = await u.getIdToken();
    const res = await fetch("/api/invites/mine", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const j = (await res.json()) as { invites?: PendingInvite[] };
    return j.invites ?? [];
  } catch {
    return [];
  }
}

async function rsvpInvite(
  inviteId: string,
  status: "going" | "maybe" | "declined",
  declineComment: string | null
): Promise<boolean> {
  const auth = getFirebaseAuth();
  const u = auth?.currentUser;
  if (!u) return false;
  try {
    const token = await u.getIdToken();
    const res = await fetch(`/api/invites/${encodeURIComponent(inviteId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status, declineComment }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ConfirmLeaveDialog({
  tripName,
  onConfirm,
  onCancel,
  busy,
}: {
  tripName: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-leave-title"
    >
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xl">
        <h2
          id="confirm-leave-title"
          className="font-[family-name:var(--font-instrument-serif)] text-xl font-normal text-stone-900"
        >
          Leave this trip?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          <span className="font-semibold text-stone-800">
            {tripName.trim() || "Untitled trip"}
          </span>{" "}
          will be removed from your list. You can rejoin anytime with the invite
          code.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
          >
            {busy ? "Leaving…" : "Yes, leave trip"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50 disabled:opacity-45"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteCard({
  invite,
  onRsvp,
}: {
  invite: PendingInvite;
  onRsvp: (id: string, status: "going" | "maybe" | "declined", comment: string | null) => Promise<void>;
}) {
  const [declining, setDeclining] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 via-white to-white p-4 shadow-sm">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700/80">
          Trip invite
        </p>
        <p className="mt-1 font-[family-name:var(--font-instrument-serif)] text-lg font-normal text-stone-900">
          {invite.tripName.trim() || "Untitled trip"}
        </p>
        <p className="text-sm text-stone-500">
          from <span className="font-semibold text-stone-700">{invite.invitedByName}</span>
        </p>
      </div>
      {declining ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note (optional)"
            rows={2}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/70"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await onRsvp(invite.id, "declined", comment.trim() || null);
                setBusy(false);
              }}
              className="rounded-xl bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-45"
            >
              {busy ? "Sending…" : "Send"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeclining(false)}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 disabled:opacity-45"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onRsvp(invite.id, "going", null);
              setBusy(false);
            }}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-45"
          >
            Going
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onRsvp(invite.id, "maybe", null);
              setBusy(false);
            }}
            className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-45"
          >
            Maybe
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setDeclining(true)}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 shadow-sm transition-colors hover:border-stone-300 hover:text-stone-900 disabled:opacity-45"
          >
            Can&apos;t make it
          </button>
        </div>
      )}
    </li>
  );
}

function PipEmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <div style={{ animation: "gathr-pip-bob 3s ease-in-out infinite" }}>
        <Pip size={72} mood="happy" tilt={-8} />
      </div>
      <p className="font-[family-name:var(--font-instrument-serif)] text-lg text-stone-700">
        Plan a trip today
      </p>
      <div className="flex items-end gap-1 text-stone-400">
        <span className="text-sm">Tap</span>
        {/* Curly arrow SVG pointing down-right toward the + button */}
        <svg
          viewBox="0 0 56 40"
          className="h-8 w-14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 4 C8 4 14 6 18 14 C22 22 20 32 28 36" />
          <polyline points="22,36 28,36 28,30" />
        </svg>
        <span className="text-sm pb-1">below to get started</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [showOnboardingCue, setShowOnboardingCue] = useState(false);
  const [myTrips, setMyTrips] = useState<MyTripSummary[]>([]);
  const [myTripsLoading, setMyTripsLoading] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<MyTripSummary | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

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

  const loadInvites = useCallback(async () => {
    if (!user) { setPendingInvites([]); return; }
    const invites = await fetchPendingInvites();
    setPendingInvites(invites);
  }, [user]);

  useEffect(() => {
    void loadMyTrips();
  }, [loadMyTrips]);

  useEffect(() => {
    void loadInvites();
  }, [loadInvites]);

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

  const handleRsvp = useCallback(
    async (inviteId: string, status: "going" | "maybe" | "declined", comment: string | null) => {
      const ok = await rsvpInvite(inviteId, status, comment);
      if (!ok) return;
      setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId));
      if (status === "going" || status === "maybe") {
        await loadMyTrips();
      }
    },
    [loadMyTrips]
  );

  const confirmLeave = useCallback(async () => {
    if (!pendingLeave) return;
    setLeaveBusy(true);
    try {
      await forgetTripClient(pendingLeave.id);
      setMyTrips((prev) => prev.filter((t) => t.id !== pendingLeave.id));
      notifyMyTripsUpdated();
      setPendingLeave(null);
    } finally {
      setLeaveBusy(false);
    }
  }, [pendingLeave]);

  return (
    <>
      {pendingLeave ? (
        <ConfirmLeaveDialog
          tripName={pendingLeave.name}
          onConfirm={() => void confirmLeave()}
          onCancel={() => setPendingLeave(null)}
          busy={leaveBusy}
        />
      ) : null}

      <div className="relative flex min-h-full flex-1 flex-col">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-15%,rgb(255_228_230/0.45),transparent)]"
          aria-hidden
        />
        <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <h1 className="font-[family-name:var(--font-instrument-serif)] text-2xl font-normal tracking-tight text-stone-900 sm:text-[1.75rem]">
              Home
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
                <h2 className="font-[family-name:var(--font-instrument-serif)] text-lg font-normal leading-snug text-stone-900">
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

          {user && pendingInvites.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="font-[family-name:var(--font-instrument-serif)] text-lg font-normal text-stone-900">
                Pending invites
              </h2>
              <ul className="flex flex-col gap-3">
                {pendingInvites.map((inv) => (
                  <InviteCard key={inv.id} invite={inv} onRsvp={handleRsvp} />
                ))}
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-4 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(15_15_15/0.04),0_4px_24px_rgb(15_15_15/0.03)] sm:p-6">
            {user ? (
              <>
                <h2 className="font-[family-name:var(--font-instrument-serif)] text-lg font-normal text-stone-900">
                  Your trips
                </h2>
                {myTripsLoading ? (
                  <p className="text-sm text-stone-500">Loading your trips…</p>
                ) : myTrips.length === 0 ? (
                  <PipEmptyState />
                ) : (
                  <ul className="flex flex-col gap-2">
                    {myTrips.map((t) => (
                      <li key={t.id} className="flex items-center gap-2">
                        <Link
                          href={`/trip/${t.id}`}
                          className="flex flex-1 flex-col rounded-xl border border-stone-200/90 bg-stone-50/50 px-4 py-3 transition-colors hover:border-rose-200 hover:bg-rose-50/30 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <span className="font-semibold text-stone-900">
                            {t.name.trim() || "Untitled trip"}
                          </span>
                          <span className="font-mono text-xs tracking-wider text-stone-500 sm:text-right">
                            {t.shareCode}
                          </span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => setPendingLeave(t)}
                          className="shrink-0 rounded-lg p-2 text-stone-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          aria-label={`Leave ${t.name.trim() || "Untitled trip"}`}
                        >
                          <TrashIcon />
                        </button>
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
    </>
  );
}
