"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import {
  fetchProfile,
  getOrCreateProfileId,
} from "@/lib/profile-client";
import { CABIN_OPTIONS } from "@/lib/travel-class";
import {
  MY_TRIPS_UPDATED_EVENT,
  jsonHeadersWithOptionalAuth,
} from "@/lib/trips-client";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/80";

const CABIN_VALUES: Set<string> = new Set(
  CABIN_OPTIONS.map((o) => o.value)
);

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TripActionsSheet({ open, onClose }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [tripName, setTripName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | "addMe" | null>(null);
  const [joinPreview, setJoinPreview] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [joinPreviewLoading, setJoinPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setTripName("");
      setJoinCode("");
      setJoinPreview(null);
      setBusy(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setJoinPreview(null);
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 8) {
      setJoinPreviewLoading(false);
      return;
    }

    const handle = window.setTimeout(() => {
      void (async () => {
        setJoinPreviewLoading(true);
        try {
          const res = await fetch(
            `/api/trips/by-code?code=${encodeURIComponent(code)}`
          );
          if (!res.ok) {
            setJoinPreview(null);
            return;
          }
          const j = (await res.json()) as {
            id?: string;
            name?: string;
          };
          if (j.id) {
            setJoinPreview({ id: j.id, name: String(j.name ?? "").trim() });
          }
        } catch {
          setJoinPreview(null);
        } finally {
          setJoinPreviewLoading(false);
        }
      })();
    }, 400);

    return () => window.clearTimeout(handle);
  }, [joinCode, open]);

  const createTrip = useCallback(async () => {
    setError(null);
    setBusy("create");
    try {
      const headers = await jsonHeadersWithOptionalAuth();
      const res = await fetch("/api/trips", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: tripName.trim() || "Family trip" }),
      });
      let j: { id?: string; error?: string };
      try {
        j = (await res.json()) as { id?: string; error?: string };
      } catch {
        setError(
          "The server returned an invalid response. If you use a Network URL for dev, set NEXT_DEV_ALLOWED_ORIGINS and restart the server."
        );
        return;
      }
      if (!res.ok) {
        setError(j.error ?? "Could not create trip.");
        return;
      }
      if (j.id) {
        if (user) {
          window.dispatchEvent(new Event(MY_TRIPS_UPDATED_EVENT));
        }
        onClose();
        router.push(`/trip/${j.id}`);
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }, [router, tripName, user, onClose]);

  const joinTrip = useCallback(async () => {
    setError(null);
    setBusy("join");
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await fetch(
        `/api/trips/by-code?code=${encodeURIComponent(code)}`
      );
      let j: { id?: string; error?: string };
      try {
        j = (await res.json()) as { id?: string; error?: string };
      } catch {
        setError("Bad response from server.");
        return;
      }
      if (!res.ok) {
        setError(j.error ?? "Could not find that code.");
        return;
      }
      if (j.id) {
        onClose();
        router.push(`/trip/${j.id}`);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }, [router, joinCode, onClose]);

  const addMeToTrip = useCallback(async () => {
    setError(null);
    setBusy("addMe");
    try {
      const code = joinCode.trim().toUpperCase();
      if (code.length !== 8) {
        setError("Enter the full 8-character invite code.");
        return;
      }

      let tripId = joinPreview?.id;
      if (!tripId) {
        const res = await fetch(
          `/api/trips/by-code?code=${encodeURIComponent(code)}`
        );
        let j: { id?: string; name?: string; error?: string };
        try {
          j = (await res.json()) as typeof j;
        } catch {
          setError("Bad response from server.");
          return;
        }
        if (!res.ok) {
          setError(j.error ?? "Could not find that code.");
          return;
        }
        if (!j.id) {
          setError("Could not find that code.");
          return;
        }
        tripId = j.id;
      }

      if (!user) {
        getOrCreateProfileId();
      }
      const profile = await fetchProfile();
      if (!profile) {
        setError(
          "Save your travel profile first (name and home airport). Open Profile from the tab below."
        );
        return;
      }
      const displayName = profile.displayName.trim();
      const homeAirport = profile.homeAirport.trim().toUpperCase();
      if (!displayName || displayName.length > 80) {
        setError(
          "Add your display name in Profile, then try again."
        );
        return;
      }
      if (!/^[A-Z]{3}$/.test(homeAirport)) {
        setError(
          "Set a valid 3-letter home airport in Profile, then try again."
        );
        return;
      }

      const cabinClass = CABIN_VALUES.has(profile.preferredCabin)
        ? profile.preferredCabin
        : "economy";

      const headers = await jsonHeadersWithOptionalAuth();
      const tr = await fetch(`/api/trips/${tripId}/travelers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          displayName,
          homeAirport,
          adults: Math.min(9, Math.max(1, profile.familyAdults || 1)),
          children: Math.min(8, Math.max(0, profile.familyChildren || 0)),
          cabinClass,
        }),
      });
      let tj: { error?: string };
      try {
        tj = (await tr.json()) as { error?: string };
      } catch {
        setError("Invalid response when adding you to the trip.");
        return;
      }
      if (!tr.ok) {
        setError(tj.error ?? "Could not add you to the trip.");
        return;
      }

      window.dispatchEvent(new Event(MY_TRIPS_UPDATED_EVENT));
      onClose();
      router.push(`/trip/${tripId}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }, [joinCode, joinPreview, router, user, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex flex-col bg-stone-50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-actions-title"
      >
        <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between gap-3 border-b border-stone-200/90 bg-stone-50/95 px-4 py-3 backdrop-blur-md">
          <h2
            id="trip-actions-title"
            className="font-[family-name:var(--font-source-serif)] text-lg font-normal text-stone-900"
          >
            New or join a trip
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-200/60 hover:text-stone-900 disabled:opacity-45"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-28">
          {error ? (
            <p
              className="mb-6 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm leading-relaxed text-red-800 shadow-sm"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <section className="flex flex-col gap-5 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Create new trip
            </h3>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-stone-700">Trip name</span>
              <input
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                placeholder="Summer reunion"
                className={inputClass}
              />
            </label>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void createTrip()}
              className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
            >
              {busy === "create" ? "Creating…" : "Create trip"}
            </button>
          </section>

          <section className="mt-8 flex flex-col gap-5 rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Join existing trip
            </h3>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-stone-700">Invite code</span>
              <input
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(
                    e.target.value.toUpperCase().replace(/\s/g, "")
                  )
                }
                placeholder="e.g. K7M2NP9Q"
                className={`${inputClass} font-mono tracking-[0.2em]`}
                maxLength={10}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {joinPreviewLoading && joinCode.trim().length === 8 ? (
              <p className="text-xs text-stone-500">Looking up that code…</p>
            ) : null}
            {joinPreview && joinCode.trim().toUpperCase().length === 8 ? (
              <p className="text-sm text-stone-600">
                <span className="font-medium text-stone-700">Found:</span>{" "}
                {joinPreview.name || "Trip"}{" "}
                <span className="text-stone-400">
                  · add yourself with your profile
                </span>
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy !== null || joinCode.trim().length < 8}
              onClick={() => void addMeToTrip()}
              className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
            >
              {busy === "addMe" ? "Adding you…" : "Add me to this trip"}
            </button>
            <p className="text-xs leading-relaxed text-stone-500">
              Uses your saved profile. Update details in the{" "}
              <Link
                href="/profile"
                className="font-semibold text-rose-600 underline-offset-2 hover:underline"
                onClick={onClose}
              >
                Profile
              </Link>{" "}
              tab.
            </p>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void joinTrip()}
              className="rounded-xl border border-stone-200 bg-stone-50/80 py-3 text-sm font-semibold text-stone-800 shadow-sm transition-colors hover:border-stone-300 hover:bg-white disabled:opacity-45"
            >
              {busy === "join"
                ? "Opening…"
                : "Open trip only (don’t add me yet)"}
            </button>
          </section>
        </div>
      </div>
      <SubmitHangarOverlay
        open={busy !== null}
        message={
          busy === "addMe"
            ? "Adding you with your profile…"
            : busy === "join"
              ? "Opening the trip…"
              : busy === "create"
                ? "Creating your trip…"
                : ""
        }
      />
    </>
  );
}
