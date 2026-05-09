"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Pip } from "@/components/pip";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import {
  fetchProfile,
  getOrCreateProfileId,
  type ClientProfile,
} from "@/lib/profile-client";
import {
  forgetTripClient,
  jsonHeadersWithOptionalAuth,
  notifyMyTripsUpdated,
  rememberTripClient,
} from "@/lib/trips-client";
import type { ParsedFlightOption } from "@/lib/serpapi-google-flights";
import { buildGoogleFlightsFltUrl } from "@/lib/google-flights-url";
import { formatFlightDateTime } from "@/lib/format-flight-time";
import { CABIN_OPTIONS, cabinLabel } from "@/lib/travel-class";
import { DestinationPoll, DatePoll, ChatSection } from "./trip-collaboration";
import type { Proposal } from "./trip-collaboration";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/70";

const labelClass = "font-medium text-stone-700";

const panelClass =
  "rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_3px_rgb(15_15_15/0.04)] sm:p-5";

const sectionTitle =
  "font-[family-name:var(--font-instrument-serif)] text-xl font-normal text-stone-900";

const CABIN_VALUES: Set<string> = new Set(CABIN_OPTIONS.map((o) => o.value));

export type TripTraveler = {
  id: string;
  displayName: string;
  homeAirport: string;
  adults: number;
  children: number;
  cabinClass: string;
};

export type TripInitial = {
  id: string;
  name: string;
  shareCode: string;
  phase: "voting" | "flights";
  pollDeadline: string | null;
  winningDestination: Proposal | null;
  winningDates: Proposal | null;
  travelers: TripTraveler[];
};

type QuoteRow = {
  travelerId: string;
  displayName: string;
  origin: string;
  destination: string;
  adults: number;
  children: number;
  cabinClass: string;
  currency: string | null;
  error: string | null;
  viewAllUrl: string | null;
  options: ParsedFlightOption[];
};

// ─── Confirm Leave Dialog ─────────────────────────────────────────────────────

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
      aria-labelledby="confirm-leave-trip-title"
    >
      <div
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-stone-200/90 bg-white p-6 shadow-xl">
        <h2
          id="confirm-leave-trip-title"
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

// ─── Phase Banner ─────────────────────────────────────────────────────────────

function friendlyDeadline(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function PhaseBanner({
  phase,
  pollDeadline,
  tripId,
  winningDestination,
  winningDates,
  onDeadlineChange,
}: {
  phase: "voting" | "flights";
  pollDeadline: string | null;
  tripId: string;
  winningDestination: Proposal | null;
  winningDates: Proposal | null;
  onDeadlineChange: (dl: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftDeadline, setDraftDeadline] = useState(
    pollDeadline ? pollDeadline.slice(0, 16) : ""
  );
  const [saving, setSaving] = useState(false);

  const saveDeadline = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pollDeadline: draftDeadline ? new Date(draftDeadline).toISOString() : null,
        }),
      });
      if (res.ok) {
        const j = (await res.json()) as { pollDeadline?: string | null };
        onDeadlineChange(j.pollDeadline ?? null);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }, [tripId, draftDeadline, onDeadlineChange]);

  if (phase === "flights") {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/60 via-white to-white p-5 shadow-sm">
        <div style={{ animation: "pip-fly-across 3.2s linear infinite", flexShrink: 0 }}>
          <Pip size={48} mood="happy" tilt={-12} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
            Voting closed · Let&apos;s fly!
          </p>
          <p className="mt-0.5 font-[family-name:var(--font-instrument-serif)] text-lg leading-snug text-stone-900">
            {winningDestination?.label ?? "Destination TBD"}
          </p>
          {winningDates?.label ? (
            <p className="text-sm text-stone-500">{winningDates.label}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-4 rounded-2xl border border-rose-100/90 bg-gradient-to-r from-rose-50/50 via-white to-white p-5 shadow-sm">
      <div style={{ animation: "gathr-pip-bob 3s ease-in-out infinite", flexShrink: 0 }}>
        <Pip size={48} mood="wink" tilt={-8} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700/80">
          Voting open
        </p>
        <p className="font-[family-name:var(--font-instrument-serif)] text-lg leading-snug text-stone-900">
          Where should we go?
        </p>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              value={draftDeadline}
              onChange={(e) => setDraftDeadline(e.target.value)}
              className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveDeadline()}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-45"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-2 py-1.5 text-xs font-semibold text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        ) : pollDeadline ? (
          <p className="text-xs text-stone-500">
            Votes close{" "}
            <span className="font-semibold text-stone-700">
              {friendlyDeadline(pollDeadline)}
            </span>{" "}
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-1 font-semibold text-rose-600 underline-offset-2 hover:underline"
            >
              Change
            </button>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start text-xs font-semibold text-rose-600 underline-offset-2 hover:underline"
          >
            Set a voting deadline →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Invite Section ──────────────────────────────────────────────────────────

type InviteRecord = {
  id: string;
  invitedDisplayName: string;
  invitedUsername: string;
  status: "pending" | "going" | "maybe" | "declined";
  declineComment: string | null;
};

function InviteSection({ tripId }: { tripId: string }) {
  const [username, setUsername] = useState("");
  const [found, setFound] = useState<{ uid: string; username: string; displayName: string } | null | "none">(null);
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { getFirebaseAuth } = await import("@/lib/firebase-client");
        const auth = getFirebaseAuth();
        const u = auth?.currentUser;
        if (!u) return;
        const token = await u.getIdToken();
        const r = await fetch(`/api/trips/${tripId}/invites`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) return;
        const j = (await r.json()) as { invites?: InviteRecord[] };
        if (j?.invites) setInvites(j.invites);
      } catch {
        /* ignore */
      }
    })();
  }, [tripId]);

  const lookupUser = useCallback((raw: string) => {
    const normalized = raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (normalized.length < 3) {
      setFound(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    setFound(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void fetch(`/api/users/search?q=${encodeURIComponent(normalized)}`)
        .then((r) => r.json())
        .then((j: { user: { uid: string; username: string; displayName: string } | null }) => {
          setFound(j.user ?? "none");
          setChecking(false);
        })
        .catch(() => { setChecking(false); });
    }, 500);
  }, []);

  const sendInvite = useCallback(async () => {
    if (!found || found === "none") return;
    setSending(true);
    setSendError(null);
    setSendSuccess(false);
    try {
      const { getFirebaseAuth } = await import("@/lib/firebase-client");
      const auth = getFirebaseAuth();
      const u = auth?.currentUser;
      if (!u) { setSendError("Sign in required."); return; }
      const token = await u.getIdToken();
      const res = await fetch(`/api/trips/${tripId}/invites`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ username: found.username }),
      });
      const j = (await res.json()) as { invite?: InviteRecord; error?: string };
      if (!res.ok) {
        setSendError(j.error ?? "Could not send invite.");
        return;
      }
      if (j.invite) {
        setInvites((prev) => {
          const exists = prev.some((i) => i.id === j.invite!.id);
          return exists ? prev : [j.invite!, ...prev];
        });
      }
      setSendSuccess(true);
      setUsername("");
      setFound(null);
    } finally {
      setSending(false);
    }
  }, [found, tripId]);

  const statusLabel = (s: InviteRecord["status"]) => {
    if (s === "going") return "Going ✓";
    if (s === "maybe") return "Maybe";
    if (s === "declined") return "Can't make it";
    return "Invited";
  };

  const statusColor = (s: InviteRecord["status"]) => {
    if (s === "going") return "text-emerald-700";
    if (s === "maybe") return "text-amber-600";
    if (s === "declined") return "text-red-600";
    return "text-stone-500";
  };

  return (
    <div className={`${panelClass} flex flex-col gap-4`}>
      <p className={sectionTitle}>Invite friends</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-stone-400 text-sm">@</span>
          <input
            value={username}
            onChange={(e) => {
              const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
              setUsername(val);
              setSendSuccess(false);
              setSendError(null);
              lookupUser(val);
            }}
            placeholder="username"
            autoCapitalize="none"
            autoCorrect="off"
            className={`${inputClass} pl-7 text-sm`}
          />
        </div>
        <button
          type="button"
          disabled={!found || found === "none" || sending}
          onClick={() => void sendInvite()}
          className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
        >
          {sending ? "Sending…" : "Invite"}
        </button>
      </div>
      {checking ? (
        <p className="text-xs text-stone-400">Searching…</p>
      ) : found === "none" && username.length >= 3 ? (
        <p className="text-xs text-stone-500">No user found with that username.</p>
      ) : found && found !== "none" ? (
        <p className="text-xs font-semibold text-stone-700">
          Found: {found.displayName} <span className="text-stone-400">(@{found.username})</span>
        </p>
      ) : null}
      {sendError ? <p className="text-xs font-semibold text-red-600">{sendError}</p> : null}
      {sendSuccess ? <p className="text-xs font-semibold text-emerald-700">Invite sent!</p> : null}
      {invites.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-stone-100 pt-3">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-sm">
              <span className="font-semibold text-stone-800">{inv.invitedDisplayName}</span>
              <span className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-stone-400">@{inv.invitedUsername}</span>
                <span className={`text-xs font-semibold ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── TripWorkspace ────────────────────────────────────────────────────────────

export function TripWorkspace({ initial }: { initial: TripInitial }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState(initial.name);
  const [phase, setPhase] = useState<"voting" | "flights">(initial.phase);
  const [pollDeadline, setPollDeadline] = useState<string | null>(initial.pollDeadline);
  const [winningDestination, setWinningDestination] = useState<Proposal | null>(
    initial.winningDestination
  );
  const [winningDates, setWinningDates] = useState<Proposal | null>(initial.winningDates);
  const [travelers, setTravelers] = useState<TripTraveler[]>(initial.travelers);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initial.name);

  const [tName, setTName] = useState("");
  const [tAirport, setTAirport] = useState("");
  const [tAdults, setTAdults] = useState(1);
  const [tChildren, setTChildren] = useState(0);
  const [tCabin, setTCabin] = useState<string>("economy");

  const [dest, setDest] = useState(
    initial.winningDestination?.iata ?? initial.winningDestination?.label ?? ""
  );
  const [depart, setDepart] = useState(initial.winningDates?.dateStart ?? "");
  const [ret, setRet] = useState(initial.winningDates?.dateEnd ?? "");

  const [loadingTraveler, setLoadingTraveler] = useState(false);
  const [joiningFromProfile, setJoiningFromProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState<ClientProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestions, setErrorSuggestions] = useState<string[] | null>(null);
  const [quoteMeta, setQuoteMeta] = useState<{
    source: string;
    groupTotal: string | null;
    groupCurrency: string;
    destination: string;
    destinationLabel?: string;
    groupTotalNote?: string;
    departureDate: string;
    returnDate?: string | null;
    fairness?: {
      medianCheapest: string | null;
      spread: string | null;
      lowestPartyName: string | null;
      highestPartyName: string | null;
      relativeSpreadPercent: string | null;
      note: string;
    };
  } | null>(null);
  const [quoteRows, setQuoteRows] = useState<QuoteRow[] | null>(null);

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);

  const clearAlert = useCallback(() => {
    setError(null);
    setErrorSuggestions(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!authLoading && !user) getOrCreateProfileId();
      const p = await fetchProfile();
      if (cancelled) return;
      setSavedProfile(p);
      setProfileReady(true);
      if (initial.travelers.length > 0) return;
      if (!p?.onboardingCompletedAt) return;
      setTName((n) => n.trim() || p.displayName);
      setTAirport((a) => a.trim() || p.homeAirport);
      setTAdults(p.familyAdults);
      setTChildren(p.familyChildren);
      setTCabin(CABIN_VALUES.has(p.preferredCabin) ? p.preferredCabin : "economy");
    })();
    return () => { cancelled = true; };
  }, [authLoading, user?.uid, initial.travelers.length, initial.id]);

  useEffect(() => {
    if (authLoading || !user) return;
    void (async () => {
      const ok = await rememberTripClient(initial.id);
      if (ok) notifyMyTripsUpdated();
    })();
  }, [authLoading, user?.uid, initial.id]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/trip/${initial.id}`;
  }, [initial.id]);

  const alreadyOnTrip = useMemo(() => {
    if (!savedProfile?.displayName?.trim() || !savedProfile?.homeAirport?.trim()) return false;
    const ap = savedProfile.homeAirport.trim().toUpperCase();
    const nm = savedProfile.displayName.trim().toLowerCase();
    return travelers.some(
      (t) =>
        t.homeAirport.trim().toUpperCase() === ap &&
        t.displayName.trim().toLowerCase() === nm
    );
  }, [savedProfile, travelers]);

  const canJoinWithProfile = useMemo(() => {
    if (!savedProfile) return false;
    const displayName = savedProfile.displayName.trim();
    const homeAirport = savedProfile.homeAirport.trim().toUpperCase();
    if (!displayName || displayName.length > 80) return false;
    if (!/^[A-Z]{3}$/.test(homeAirport)) return false;
    return true;
  }, [savedProfile]);

  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(initial.shareCode);
  }, [initial.shareCode]);

  const copyLink = useCallback(() => {
    if (shareUrl) void navigator.clipboard.writeText(shareUrl);
  }, [shareUrl]);

  const saveName = useCallback(async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    clearAlert();
    const res = await fetch(`/api/trips/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setError(j.error ?? "Could not update name.");
      return;
    }
    const data = (await res.json()) as TripInitial;
    setName(data.name);
    setEditingName(false);
    if (user) {
      const ok = await rememberTripClient(initial.id);
      if (ok) notifyMyTripsUpdated();
    }
  }, [initial.id, nameDraft, clearAlert, user]);

  const addTraveler = useCallback(async () => {
    clearAlert();
    setLoadingTraveler(true);
    try {
      const headers = await jsonHeadersWithOptionalAuth();
      const res = await fetch(`/api/trips/${initial.id}/travelers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          displayName: tName,
          homeAirport: tAirport,
          adults: tAdults,
          children: tChildren,
          cabinClass: tCabin,
        }),
      });
      const j = (await res.json()) as TripTraveler | { error?: string };
      if (!res.ok) {
        setError("error" in j ? (j.error ?? "Failed") : "Failed");
        return;
      }
      if ("id" in j) {
        setTravelers((prev) => [...prev, j]);
        setTName("");
        setTAirport("");
        setTAdults(1);
        setTChildren(0);
        setTCabin("economy");
        notifyMyTripsUpdated();
      }
    } finally {
      setLoadingTraveler(false);
    }
  }, [initial.id, tName, tAirport, tAdults, tChildren, tCabin, clearAlert]);

  const joinTripWithMyProfile = useCallback(async () => {
    if (!savedProfile || !canJoinWithProfile) return;
    clearAlert();
    setJoiningFromProfile(true);
    try {
      const displayName = savedProfile.displayName.trim();
      const homeAirport = savedProfile.homeAirport.trim().toUpperCase();
      const cabinClass = CABIN_VALUES.has(savedProfile.preferredCabin)
        ? savedProfile.preferredCabin
        : "economy";
      const headers = await jsonHeadersWithOptionalAuth();
      const res = await fetch(`/api/trips/${initial.id}/travelers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          displayName,
          homeAirport,
          adults: Math.min(9, Math.max(1, savedProfile.familyAdults || 1)),
          children: Math.min(8, Math.max(0, savedProfile.familyChildren || 0)),
          cabinClass,
        }),
      });
      const j = (await res.json()) as TripTraveler | { error?: string };
      if (!res.ok) {
        setError("error" in j ? (j.error ?? "Could not add you.") : "Failed");
        return;
      }
      if ("id" in j) {
        setTravelers((prev) => [...prev, j]);
        setTName("");
        setTAirport("");
        notifyMyTripsUpdated();
      }
    } finally {
      setJoiningFromProfile(false);
    }
  }, [savedProfile, canJoinWithProfile, initial.id, clearAlert]);

  const removeTraveler = useCallback(
    async (travelerId: string) => {
      clearAlert();
      const res = await fetch(`/api/trips/${initial.id}/travelers/${travelerId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setError(j.error ?? "Could not remove traveler.");
        return;
      }
      setTravelers((prev) => prev.filter((t) => t.id !== travelerId));
      setQuoteRows(null);
      setQuoteMeta(null);
    },
    [initial.id, clearAlert]
  );

  const leaveTrip = useCallback(async () => {
    setLeaveBusy(true);
    try {
      await forgetTripClient(initial.id);
      notifyMyTripsUpdated();
      router.replace("/");
    } finally {
      setLeaveBusy(false);
    }
  }, [initial.id, router]);

  const runQuotes = useCallback(async () => {
    clearAlert();
    setLoadingQuotes(true);
    setQuoteRows(null);
    setQuoteMeta(null);
    try {
      const res = await fetch(`/api/trips/${initial.id}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: dest,
          departureDate: depart,
          returnDate: ret || undefined,
        }),
      });
      let j:
        | {
            source: string;
            rows: QuoteRow[];
            groupTotal: string | null;
            groupCurrency: string;
            destination: string;
            departureDate: string;
            returnDate?: string | null;
            destinationLabel?: string;
            groupTotalNote?: string;
            fairness?: {
              medianCheapest: string | null;
              spread: string | null;
              lowestPartyName: string | null;
              highestPartyName: string | null;
              relativeSpreadPercent: string | null;
              note: string;
            };
            error?: string;
          }
        | { error: string; suggestions?: string[] };
      try {
        j = (await res.json()) as typeof j;
      } catch {
        setError("Invalid response from server.");
        return;
      }
      if (!res.ok) {
        const msg = "error" in j && j.error ? j.error : "Quote request failed.";
        const sug =
          "suggestions" in j && Array.isArray(j.suggestions) && j.suggestions.length > 0
            ? j.suggestions
            : null;
        setErrorSuggestions(sug);
        setError(msg);
        return;
      }
      if (!("rows" in j)) return;
      setQuoteRows(j.rows);
      setQuoteMeta({
        source: j.source,
        groupTotal: j.groupTotal,
        groupCurrency: j.groupCurrency,
        destination: j.destination,
        destinationLabel: j.destinationLabel,
        groupTotalNote: j.groupTotalNote,
        departureDate: j.departureDate,
        returnDate: j.returnDate ?? undefined,
        fairness: j.fairness,
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoadingQuotes(false);
    }
  }, [initial.id, dest, depart, ret, clearAlert]);

  return (
    <>
      {showLeaveConfirm ? (
        <ConfirmLeaveDialog
          tripName={name}
          onConfirm={() => void leaveTrip()}
          onCancel={() => setShowLeaveConfirm(false)}
          busy={leaveBusy}
        />
      ) : null}

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">

        {/* ── Shared header ── */}
        <header className="flex flex-col gap-5 border-b border-stone-200/90 pb-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
            >
              ← Trips
            </Link>
            {user ? (
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(true)}
                className="text-sm font-medium text-stone-400 underline-offset-4 hover:text-red-600 hover:underline"
              >
                Leave trip
              </button>
            ) : null}
          </div>

          {editingName ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className={`${inputClass} max-w-md text-xl font-semibold`}
              />
              <button
                type="button"
                onClick={() => void saveName()}
                className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setNameDraft(name); setEditingName(false); }}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-stone-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-[family-name:var(--font-instrument-serif)] text-3xl font-normal tracking-tight text-stone-900">
                {name}
              </h1>
              <button
                type="button"
                onClick={() => { setNameDraft(name); setEditingName(true); }}
                className="text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
              >
                Rename
              </button>
            </div>
          )}

          <div className={`${panelClass} flex flex-col gap-4 bg-stone-50/60 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                Invite code
              </p>
              <p className="mt-1 font-mono text-xl font-semibold tracking-[0.18em] text-stone-900">
                {initial.shareCode}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyCode}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50"
              >
                Copy code
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
              >
                Copy link
              </button>
            </div>
          </div>
        </header>

        {/* ── Phase banner ── */}
        <PhaseBanner
          phase={phase}
          pollDeadline={pollDeadline}
          tripId={initial.id}
          winningDestination={winningDestination}
          winningDates={winningDates}
          onDeadlineChange={(dl) => {
            setPollDeadline(dl);
            // re-compute phase client-side
            setPhase(dl && new Date(dl) < new Date() ? "flights" : "voting");
          }}
        />

        {error ? (
          <div
            className="rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm leading-relaxed text-red-800 shadow-sm"
            role="alert"
          >
            <p>{error}</p>
            {errorSuggestions && errorSuggestions.length > 0 ? (
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-xs text-red-900/85">
                {errorSuggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* ── Voting phase content ── */}
        {phase === "voting" ? (
          <div className="flex flex-col gap-6">
            <div className={`${panelClass} flex flex-col gap-6`}>
              <DestinationPoll tripId={initial.id} votingOpen />
              <div className="border-t border-stone-100" />
              <DatePoll tripId={initial.id} votingOpen />
            </div>
            {user ? <InviteSection tripId={initial.id} /> : null}
            <div className={panelClass}>
              <ChatSection tripId={initial.id} />
            </div>
          </div>
        ) : null}

        {/* ── Flights phase content ── */}
        {phase === "flights" ? (
          <div className="flex flex-col gap-8">

            {/* Travelers */}
            <section className="flex flex-col gap-5">
              <h2 className={sectionTitle}>Who&apos;s going</h2>

              {!authLoading && profileReady && alreadyOnTrip ? (
                <p className="text-sm leading-relaxed text-stone-600">
                  You&apos;re already listed as{" "}
                  <strong className="font-semibold text-stone-800">
                    {savedProfile?.displayName?.trim()}
                  </strong>{" "}
                  ({savedProfile?.homeAirport?.trim().toUpperCase()}).
                </p>
              ) : null}

              {!authLoading && profileReady && canJoinWithProfile && !alreadyOnTrip ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50/80 via-white to-white p-5 shadow-[0_4px_24px_rgb(225_29_72/0.06)] sm:p-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700/85">
                      Quick join
                    </p>
                    <p className="mt-2 text-sm font-semibold text-stone-900">
                      Join with your saved profile
                    </p>
                  </div>
                  <div className="rounded-xl border border-stone-200/80 bg-white/90 px-4 py-3 text-sm text-stone-700">
                    <p className="font-semibold text-stone-900">
                      {savedProfile?.displayName?.trim()}
                    </p>
                    <p className="mt-0.5 font-mono text-stone-600">
                      from {savedProfile?.homeAirport?.trim().toUpperCase()}
                    </p>
                    <p className="mt-2 text-xs text-stone-500">
                      {savedProfile?.familyAdults ?? 1} adult
                      {(savedProfile?.familyAdults ?? 1) !== 1 ? "s" : ""}
                      {(savedProfile?.familyChildren ?? 0) > 0
                        ? `, ${savedProfile?.familyChildren} child${(savedProfile?.familyChildren ?? 0) !== 1 ? "ren" : ""}`
                        : ""}
                      {" · "}
                      {cabinLabel(
                        CABIN_VALUES.has(savedProfile?.preferredCabin ?? "")
                          ? (savedProfile?.preferredCabin ?? "economy")
                          : "economy"
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={joiningFromProfile || loadingTraveler}
                    onClick={() => void joinTripWithMyProfile()}
                    className="rounded-xl bg-rose-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
                  >
                    {joiningFromProfile ? "Adding you…" : "Join this trip"}
                  </button>
                </div>
              ) : null}

              <ul className="flex flex-col gap-2">
                {travelers.length === 0 ? (
                  <li className="rounded-2xl border border-dashed border-stone-200 bg-white/50 px-4 py-8 text-center text-sm leading-relaxed text-stone-500">
                    No travelers added yet.
                  </li>
                ) : (
                  travelers.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white px-4 py-3.5 shadow-sm"
                    >
                      <div>
                        <p className="font-semibold text-stone-900">{t.displayName}</p>
                        <p className="font-mono text-sm text-stone-500">from {t.homeAirport}</p>
                        <p className="mt-1 text-xs text-stone-500">
                          {t.adults} adult{t.adults !== 1 ? "s" : ""}
                          {t.children > 0
                            ? `, ${t.children} child${t.children !== 1 ? "ren" : ""}`
                            : ""}
                          {" · "}
                          {cabinLabel(t.cabinClass)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeTraveler(t.id)}
                        className="shrink-0 text-sm font-medium text-red-600/90 underline-offset-4 hover:text-red-700 hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))
                )}
              </ul>

              <div className={`${panelClass} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end`}>
                <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-sm">
                  <span className={labelClass}>Name</span>
                  <input
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    placeholder="Alex"
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-[100px] flex-1 flex-col gap-2 text-sm">
                  <span className={labelClass}>Home airport (IATA)</span>
                  <input
                    value={tAirport}
                    onChange={(e) => setTAirport(e.target.value.toUpperCase())}
                    placeholder="SEA"
                    maxLength={3}
                    className={`${inputClass} font-mono`}
                  />
                </label>
                <label className="flex min-w-[72px] w-[88px] flex-col gap-2 text-sm">
                  <span className={labelClass}>Adults</span>
                  <input
                    type="number"
                    min={1}
                    max={9}
                    value={tAdults}
                    onChange={(e) =>
                      setTAdults(Math.min(9, Math.max(1, Number.parseInt(e.target.value, 10) || 1)))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-[72px] w-[88px] flex-col gap-2 text-sm">
                  <span className={labelClass}>Children</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={tChildren}
                    onChange={(e) =>
                      setTChildren(Math.min(8, Math.max(0, Number.parseInt(e.target.value, 10) || 0)))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-sm">
                  <span className={labelClass}>Cabin</span>
                  <select
                    value={tCabin}
                    onChange={(e) => setTCabin(e.target.value)}
                    className={inputClass}
                  >
                    {CABIN_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={loadingTraveler}
                  onClick={() => void addTraveler()}
                  className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800 disabled:opacity-45"
                >
                  {loadingTraveler ? "Adding…" : "Add traveler"}
                </button>
              </div>
            </section>

            {/* Compare flights */}
            <section className="flex flex-col gap-5">
              <h2 className={sectionTitle}>Compare flights</h2>
              <p className="text-sm leading-[1.65] text-stone-500">
                Enter the{" "}
                <strong className="font-semibold text-stone-700">
                  city or 3-letter airport code
                </strong>{" "}
                everyone should fly into. Leave return blank for a one-way
                search.
              </p>
              <div className={`${panelClass} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end`}>
                <label className="flex min-w-[180px] flex-[1.25] flex-col gap-2 text-sm">
                  <span className={labelClass}>Fly into (city or code)</span>
                  <input
                    value={dest}
                    onChange={(e) => setDest(e.target.value)}
                    placeholder={winningDestination?.label ?? "Denver or DEN"}
                    autoComplete="off"
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-sm">
                  <span className={labelClass}>Depart</span>
                  <input
                    type="date"
                    value={depart}
                    onChange={(e) => setDepart(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="flex min-w-[140px] flex-1 flex-col gap-2 text-sm">
                  <span className={labelClass}>Return (optional)</span>
                  <input
                    type="date"
                    value={ret}
                    onChange={(e) => setRet(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  disabled={loadingQuotes || travelers.length === 0}
                  onClick={() => void runQuotes()}
                  className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
                >
                  {loadingQuotes ? "Searching…" : "Get prices"}
                </button>
              </div>

              {/* Google Hotels link */}
              {winningDestination ? (
                <a
                  href={`https://www.google.com/travel/hotels/${encodeURIComponent(winningDestination.label)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start text-sm font-semibold text-stone-500 underline-offset-4 hover:text-stone-800 hover:underline"
                >
                  Search hotels in {winningDestination.label} →
                </a>
              ) : null}

              {quoteMeta ? (
                <div className={`${panelClass} bg-stone-50/40`}>
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-stone-800">
                      Into{" "}
                      <span className="font-semibold text-stone-900">
                        {quoteMeta.destinationLabel ?? quoteMeta.destination}
                      </span>
                      {quoteMeta.source === "demo" ? (
                        <span className="ml-2 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900/90 ring-1 ring-amber-100">
                          Demo
                        </span>
                      ) : (
                        <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90 ring-1 ring-emerald-100">
                          Google Flights
                        </span>
                      )}
                    </p>
                    {quoteMeta.groupTotal ? (
                      <div className="text-right text-sm text-stone-500">
                        <p>
                          Group total:{" "}
                          <span className="font-semibold text-stone-900">
                            {quoteMeta.groupCurrency} {quoteMeta.groupTotal}
                          </span>
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-6">
                    {quoteRows?.map((r) => (
                      <article
                        key={r.travelerId}
                        className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
                      >
                        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                          <div>
                            <h3 className="font-[family-name:var(--font-instrument-serif)] text-lg font-normal text-stone-900">
                              {r.displayName}
                            </h3>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {r.adults} adult{r.adults !== 1 ? "s" : ""}
                              {r.children > 0
                                ? `, ${r.children} child${r.children !== 1 ? "ren" : ""}`
                                : ""}
                              {" · "}
                              {cabinLabel(r.cabinClass)}
                            </p>
                          </div>
                          <p className="font-mono text-sm text-stone-500">
                            {r.origin} → {r.destination}
                          </p>
                        </div>

                        {r.error ? (
                          <p className="text-sm text-red-600">{r.error}</p>
                        ) : (
                          <>
                            <ol className="flex flex-col gap-3">
                              {r.options.map((opt, i) => {
                                const bookHref = buildGoogleFlightsFltUrl({
                                  origin: r.origin,
                                  destination: r.destination,
                                  departureDate: quoteMeta.departureDate,
                                  returnDate: quoteMeta.returnDate || undefined,
                                });
                                const partySize = r.adults + r.children;
                                return (
                                  <li
                                    key={`${r.travelerId}-${i}-${opt.flightNumbers.join(",")}`}
                                    className="rounded-xl border border-stone-100 bg-stone-50/70 p-4 ring-1 ring-stone-100/80"
                                  >
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-rose-600/90">
                                        Option {i + 1}
                                      </span>
                                      <div className="text-right">
                                        <span className="text-lg font-semibold text-stone-900">
                                          {r.currency} {opt.price}
                                        </span>
                                        {partySize > 1 ? (
                                          <p className="mt-0.5 text-[11px] text-stone-400">
                                            Total for party of {partySize}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <dl className="grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
                                      <div>
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Depart</dt>
                                        <dd>{formatFlightDateTime(opt.departureTime)}</dd>
                                      </div>
                                      <div>
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Arrive</dt>
                                        <dd>{formatFlightDateTime(opt.arrivalTime)}</dd>
                                      </div>
                                      <div>
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Airline</dt>
                                        <dd>{opt.airlines.join(", ")}</dd>
                                      </div>
                                      <div>
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Class</dt>
                                        <dd>{opt.travelClass}</dd>
                                      </div>
                                      <div className="sm:col-span-2">
                                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Flight(s)</dt>
                                        <dd className="font-mono text-stone-800">{opt.flightNumbers.join(" · ")}</dd>
                                      </div>
                                    </dl>
                                    <div className="mt-4 border-t border-stone-200/90 pt-4">
                                      <a
                                        href={bookHref}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
                                      >
                                        Book on Google Flights
                                      </a>
                                    </div>
                                  </li>
                                );
                              })}
                            </ol>
                            {r.viewAllUrl ? (
                              <a
                                href={r.viewAllUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-4 inline-flex text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
                              >
                                View all on Google Flights →
                              </a>
                            ) : null}
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            {/* Group chat in flights phase */}
            <div className={panelClass}>
              <ChatSection tripId={initial.id} />
            </div>
          </div>
        ) : null}
      </div>

      <SubmitHangarOverlay
        open={loadingTraveler || loadingQuotes || joiningFromProfile}
        message={
          loadingQuotes
            ? "Finding flight options…"
            : joiningFromProfile
              ? "Adding you to the trip…"
              : "Adding traveler…"
        }
      />
    </>
  );
}
