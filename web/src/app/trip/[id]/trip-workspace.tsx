"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import {
  fetchProfile,
  getOrCreateProfileId,
  type ClientProfile,
} from "@/lib/profile-client";
import {
  jsonHeadersWithOptionalAuth,
  notifyMyTripsUpdated,
  rememberTripClient,
} from "@/lib/trips-client";
import type { ParsedFlightOption } from "@/lib/serpapi-google-flights";
import { buildGoogleFlightsFltUrl } from "@/lib/google-flights-url";
import { formatFlightDateTime } from "@/lib/format-flight-time";
import { CABIN_OPTIONS, cabinLabel } from "@/lib/travel-class";
import {
  TripBriefSection,
  TripGroupPlanSection,
  type TripBriefState,
} from "./trip-collaboration";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/70";

const labelClass = "font-medium text-stone-700";

const panelClass =
  "rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_3px_rgb(15_15_15/0.04)] sm:p-5";

const sectionTitle =
  "font-[family-name:var(--font-source-serif)] text-xl font-normal text-stone-900";

const CABIN_VALUES: Set<string> = new Set(
  CABIN_OPTIONS.map((o) => o.value)
);

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
  brief: TripBriefState;
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

export function TripWorkspace({ initial }: { initial: TripInitial }) {
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState(initial.name);
  const [travelers, setTravelers] = useState<TripTraveler[]>(initial.travelers);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(initial.name);
  const [brief, setBrief] = useState<TripBriefState>(initial.brief);

  const [tName, setTName] = useState("");
  const [tAirport, setTAirport] = useState("");
  const [tAdults, setTAdults] = useState(1);
  const [tChildren, setTChildren] = useState(0);
  const [tCabin, setTCabin] = useState<string>("economy");

  const [dest, setDest] = useState("");
  const [depart, setDepart] = useState("");
  const [ret, setRet] = useState("");

  const [loadingTraveler, setLoadingTraveler] = useState(false);
  const [joiningFromProfile, setJoiningFromProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState<ClientProfile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestions, setErrorSuggestions] = useState<string[] | null>(
    null
  );
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

  const clearAlert = useCallback(() => {
    setError(null);
    setErrorSuggestions(null);
  }, []);
  const [quoteRows, setQuoteRows] = useState<QuoteRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!authLoading && !user) {
        getOrCreateProfileId();
      }
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
      setTCabin(
        CABIN_VALUES.has(p.preferredCabin) ? p.preferredCabin : "economy"
      );
    })();
    return () => {
      cancelled = true;
    };
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
    if (!savedProfile?.displayName?.trim() || !savedProfile?.homeAirport?.trim()) {
      return false;
    }
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

  const refreshTrip = useCallback(async () => {
    const res = await fetch(`/api/trips/${initial.id}`);
    if (!res.ok) return;
    const data = (await res.json()) as TripInitial;
    setName(data.name);
    setTravelers(data.travelers);
    setBrief(data.brief);
  }, [initial.id]);

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
      setErrorSuggestions(null);
      setError(j.error ?? "Could not update name.");
      return;
    }
    const data = (await res.json()) as TripInitial;
    setName(data.name);
    setBrief(data.brief);
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
      const j = (await res.json()) as
        | TripTraveler
        | { error?: string };
      if (!res.ok) {
        setErrorSuggestions(null);
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
          adults: Math.min(
            9,
            Math.max(1, savedProfile.familyAdults || 1)
          ),
          children: Math.min(
            8,
            Math.max(0, savedProfile.familyChildren || 0)
          ),
          cabinClass,
        }),
      });
      const j = (await res.json()) as TripTraveler | { error?: string };
      if (!res.ok) {
        setErrorSuggestions(null);
        setError("error" in j ? (j.error ?? "Could not add you.") : "Failed");
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
      setJoiningFromProfile(false);
    }
  }, [savedProfile, canJoinWithProfile, initial.id, clearAlert]);

  const removeTraveler = useCallback(
    async (travelerId: string) => {
      clearAlert();
      const res = await fetch(
        `/api/trips/${initial.id}/travelers/${travelerId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setErrorSuggestions(null);
        setError(j.error ?? "Could not remove traveler.");
        return;
      }
      setTravelers((prev) => prev.filter((t) => t.id !== travelerId));
      setQuoteRows(null);
      setQuoteMeta(null);
    },
    [initial.id, clearAlert]
  );

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
        setErrorSuggestions(null);
        setError(
          "Invalid response from server. Try http://localhost:3000 or set NEXT_DEV_ALLOWED_ORIGINS to your computer’s IP and restart `npm run dev`."
        );
        return;
      }
      if (!res.ok) {
        const msg =
          "error" in j && j.error ? j.error : "Quote request failed.";
        const sug =
          "suggestions" in j &&
          Array.isArray(j.suggestions) &&
          j.suggestions.length > 0
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
      setErrorSuggestions(null);
      setError(
        "Could not reach the server. First search can take up to ~2 minutes (SerpAPI). If nothing loads at all, use localhost:3000 or fix NEXT_DEV_ALLOWED_ORIGINS."
      );
    } finally {
      setLoadingQuotes(false);
    }
  }, [initial.id, dest, depart, ret, clearAlert]);

  return (
    <>
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-6 border-b border-stone-200/90 pb-10">
        <Link
          href="/"
          className="text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
        >
          ← New trip
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
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
                  onClick={() => {
                    setNameDraft(name);
                    setEditingName(false);
                  }}
                  className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:border-stone-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-[family-name:var(--font-source-serif)] text-3xl font-normal tracking-tight text-stone-900">
                  {name}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(name);
                    setEditingName(true);
                  }}
                  className="text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void refreshTrip()}
                  className="text-sm font-medium text-stone-400 underline-offset-4 hover:text-stone-600 hover:underline"
                >
                  Refresh
                </button>
              </div>
            )}
            <p className="mt-3 max-w-xl text-sm leading-[1.65] text-stone-500">
              Share this code or link so everyone can open the same trip. Add
              each person and their home airport, then compare flying into one
              destination.
            </p>
          </div>
        </div>

        <div
          className={`${panelClass} flex flex-col gap-4 bg-stone-50/60 sm:flex-row sm:items-center sm:justify-between`}
        >
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

      <TripBriefSection
        tripId={initial.id}
        brief={brief}
        onUpdated={(b) => setBrief(b)}
      />

      <TripGroupPlanSection tripId={initial.id} />

      <section className="flex flex-col gap-5">
        <h2 className={sectionTitle}>Travelers</h2>

        {!authLoading && profileReady && alreadyOnTrip ? (
          <p className="text-sm leading-relaxed text-stone-600">
            You&apos;re already listed here as{" "}
            <strong className="font-semibold text-stone-800">
              {savedProfile?.displayName?.trim()}
            </strong>{" "}
            ({savedProfile?.homeAirport?.trim().toUpperCase()}).
          </p>
        ) : null}

        {!authLoading &&
        profileReady &&
        canJoinWithProfile &&
        !alreadyOnTrip ? (
          <div className="flex flex-col gap-4 rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50/80 via-white to-white p-5 shadow-[0_4px_24px_rgb(225_29_72/0.06)] sm:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-700/85">
                Quick join
              </p>
              <p className="mt-2 text-sm font-semibold text-stone-900">
                Join this trip with your profile
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                We&apos;ll add you as a traveler using the name, home airport,
                party size, and cabin from your saved profile. You can still
                edit the form below for anyone else.
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

        {!authLoading &&
        profileReady &&
        !canJoinWithProfile &&
        !alreadyOnTrip ? (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-relaxed text-amber-950">
            <p className="font-medium text-amber-900">
              Save your travel details to use quick join
            </p>
            <p className="mt-1 text-amber-900/90">
              Add your name and a 3-letter home airport in{" "}
              <Link
                href="/profile"
                className="font-semibold text-rose-700 underline-offset-2 hover:underline"
              >
                Profile
              </Link>{" "}
              (or finish{" "}
              <Link
                href="/onboarding"
                className="font-semibold text-rose-700 underline-offset-2 hover:underline"
              >
                setup
              </Link>
              ). Then you can join in one tap from here or from the home screen.
            </p>
          </div>
        ) : null}

        <ul className="flex flex-col gap-2">
          {travelers.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-stone-200 bg-white/50 px-4 py-8 text-center text-sm leading-relaxed text-stone-500">
              No travelers yet. Add each person and the IATA code for the
              airport they would normally fly from.
            </li>
          ) : (
            travelers.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white px-4 py-3.5 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-stone-900">{t.displayName}</p>
                  <p className="font-mono text-sm text-stone-500">
                    from {t.homeAirport}
                  </p>
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

        <div
          className={`${panelClass} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end`}
        >
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
                setTAdults(
                  Math.min(9, Math.max(1, Number.parseInt(e.target.value, 10) || 1))
                )
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
                setTChildren(
                  Math.min(8, Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                )
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

      <section className="flex flex-col gap-5">
        <h2 className={sectionTitle}>Compare flights</h2>
        <p className="text-sm leading-[1.65] text-stone-500">
          Enter the <strong className="font-semibold text-stone-700">city or 3-letter airport code</strong>{" "}
          everyone should fly into. Leave return blank for a one-way search.
          Each person gets up to{" "}
          <strong className="font-semibold text-stone-700">three</strong> itinerary options from
          Google Flights (sorted by price); open Google Flights to see the full
          list and book.
        </p>
        <div
          className={`${panelClass} flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end`}
        >
          <label className="flex min-w-[180px] flex-[1.25] flex-col gap-2 text-sm">
            <span className={labelClass}>Fly into (city or code)</span>
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              placeholder="Denver or DEN"
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
        <p className="text-xs leading-relaxed text-stone-400">
          Live prices usually take 30–90 seconds (one SerpAPI request per
          traveler). If buttons do nothing, open{" "}
          <span className="font-mono text-stone-500">http://localhost:3000</span> on the Mac
          running the dev server, or set{" "}
          <span className="font-mono text-stone-500">NEXT_DEV_ALLOWED_ORIGINS</span> in{" "}
          <span className="font-mono text-stone-500">.env</span> to your computer&apos;s LAN IP
          and restart <span className="font-mono text-stone-500">npm run dev</span>.
        </p>

        {quoteMeta ? (
          <div
            className={`${panelClass} bg-stone-50/40 shadow-[0_1px_3px_rgb(15_15_15/0.04),0_8px_40px_rgb(15_15_15/0.04)]`}
          >
            <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-stone-800">
                Into{" "}
                <span className="font-semibold text-stone-900">
                  {quoteMeta.destinationLabel ?? quoteMeta.destination}
                </span>
                {quoteMeta.source === "demo" ? (
                  <span className="ml-2 inline-block rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900/90 ring-1 ring-amber-100">
                    Demo — add SerpAPI for live data
                  </span>
                ) : (
                  <span className="ml-2 inline-block rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90 ring-1 ring-emerald-100">
                    Google Flights (SerpAPI)
                  </span>
                )}
              </p>
              {quoteMeta.groupTotal ? (
                <div className="text-right text-sm text-stone-500">
                  <p>
                    Group planning total:{" "}
                    <span className="font-semibold text-stone-900">
                      {quoteMeta.groupCurrency} {quoteMeta.groupTotal}
                    </span>
                  </p>
                  {quoteMeta.groupTotalNote ? (
                    <p className="mt-1 max-w-md text-xs text-stone-400">
                      {quoteMeta.groupTotalNote}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            {quoteMeta.fairness ? (
              <div className="mb-5 rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-sm text-violet-950/90 ring-1 ring-violet-100/80">
                <p className="font-semibold text-violet-900">Fairness snapshot</p>
                <p className="mt-2 text-violet-900/85">
                  {quoteMeta.fairness.medianCheapest ? (
                    <>
                      Median party total (cheapest option each):{" "}
                      <span className="font-semibold text-violet-950">
                        {quoteMeta.groupCurrency}{" "}
                        {quoteMeta.fairness.medianCheapest}
                      </span>
                      {quoteMeta.fairness.spread ? (
                        <>
                          {" "}
                          · spread{" "}
                          <span className="font-semibold text-violet-950">
                            {quoteMeta.groupCurrency}{" "}
                            {quoteMeta.fairness.spread}
                          </span>
                          {quoteMeta.fairness.relativeSpreadPercent ? (
                            <span className="text-violet-800/80">
                              {" "}
                              (
                              {quoteMeta.fairness.relativeSpreadPercent}% of
                              median)
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-violet-800/85">
                      Not enough priced parties to compute a median yet.
                    </span>
                  )}
                </p>
                {quoteMeta.fairness.lowestPartyName &&
                quoteMeta.fairness.highestPartyName &&
                quoteMeta.fairness.lowestPartyName !==
                  quoteMeta.fairness.highestPartyName ? (
                  <p className="mt-2 text-xs text-violet-800/90">
                    Lowest cheapest-option total:{" "}
                    <strong className="font-semibold text-violet-950">
                      {quoteMeta.fairness.lowestPartyName}
                    </strong>
                    . Highest:{" "}
                    <strong className="font-semibold text-violet-950">
                      {quoteMeta.fairness.highestPartyName}
                    </strong>
                    .
                  </p>
                ) : null}
                <p className="mt-2 text-xs leading-relaxed text-violet-800/85">
                  {quoteMeta.fairness.note}
                </p>
              </div>
            ) : null}
            <div className="flex flex-col gap-6">
              {quoteRows?.map((r) => (
                <article
                  key={r.travelerId}
                  className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="font-[family-name:var(--font-source-serif)] text-lg font-normal text-stone-900">
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
                                    <p className="mt-0.5 max-w-[14rem] text-[11px] leading-snug text-stone-400">
                                      Usually total for your party (
                                      {r.adults} adult
                                      {r.adults !== 1 ? "s" : ""}
                                      {r.children > 0
                                        ? `, ${r.children} child${r.children !== 1 ? "ren" : ""}`
                                        : ""}
                                      ).
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <dl className="grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                    Depart
                                  </dt>
                                  <dd className="text-stone-800">
                                    {formatFlightDateTime(opt.departureTime)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                    Arrive
                                  </dt>
                                  <dd className="text-stone-800">
                                    {formatFlightDateTime(opt.arrivalTime)}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                    Airline
                                  </dt>
                                  <dd>{opt.airlines.join(", ")}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                    Class
                                  </dt>
                                  <dd>{opt.travelClass}</dd>
                                </div>
                                <div className="sm:col-span-2">
                                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                    Flight number(s)
                                  </dt>
                                  <dd className="font-mono text-stone-800">
                                    {opt.flightNumbers.join(" · ")}
                                  </dd>
                                </div>
                                {opt.routeSummary ? (
                                  <div className="sm:col-span-2">
                                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                                      Route
                                    </dt>
                                    <dd className="font-mono text-xs text-stone-600">
                                      {opt.routeSummary}
                                    </dd>
                                  </div>
                                ) : null}
                              </dl>
                              <div className="mt-4 flex flex-col gap-2 border-t border-stone-200/90 pt-4">
                                <p className="text-xs leading-relaxed text-stone-400">
                                  Opens Google Flights with this origin,
                                  destination, and trip dates so you can pick
                                  the matching itinerary and continue to book.
                                </p>
                                <a
                                  href={bookHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex w-fit items-center justify-center rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
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
                          View all options on Google Flights →
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
