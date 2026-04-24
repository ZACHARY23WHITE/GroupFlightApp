"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SubmitHangarOverlay } from "@/components/submit-hangar-overlay";
import {
  fetchProfile,
  type ClientProfile,
} from "@/lib/profile-client";
import { CABIN_OPTIONS, cabinLabel } from "@/lib/travel-class";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/70";

const labelClass = "font-medium text-stone-700";

const panelClass =
  "rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_3px_rgb(15_15_15/0.04)] sm:p-5";

const sectionTitle =
  "font-[family-name:var(--font-source-serif)] text-xl font-normal text-stone-900";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const DURATION_OPTIONS = [
  { value: 1, label: "Weekend trip" },
  { value: 2, label: "About one week" },
  { value: 3, label: "About two weeks" },
];

type Destination = {
  destinationId: string;
  name: string;
  country: string;
  airportCode: string | null;
  thumbnail: string | null;
  startDate: string | null;
  endDate: string | null;
  flightPrice: number | null;
  hotelPrice: number | null;
  flightDurationMinutes: number | null;
  stops: number | null;
  airline: string | null;
  googleTravelUrl: string | null;
};

function formatDurationMinutes(m: number | null): string {
  if (m == null || !Number.isFinite(m)) return "—";
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function stopsLabel(n: number | null): string {
  if (n == null) return "";
  if (n === 0) return "Nonstop";
  if (n === 1) return "1 stop";
  return `${n} stops`;
}

export function ExploreClient() {
  const searchParams = useSearchParams();
  const fromQuery = searchParams.get("from")?.trim().toUpperCase() ?? "";

  const [departure, setDeparture] = useState(
    fromQuery.length === 3 ? fromQuery : ""
  );
  const [tripType, setTripType] = useState<"round_trip" | "one_way">(
    "round_trip"
  );
  const [dateMode, setDateMode] = useState<"flexible" | "calendar">(
    "flexible"
  );
  const now = useMemo(() => new Date(), []);
  const defaultMonth = now.getMonth() + 1;
  const [month, setMonth] = useState(defaultMonth);
  const [travelDuration, setTravelDuration] = useState(2);
  const [outboundDate, setOutboundDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabin, setCabin] = useState<string>("economy");

  const [profileReady, setProfileReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    source: string;
    currency: string;
    googleExploreUrl: string | null;
  } | null>(null);
  const [destinations, setDestinations] = useState<Destination[] | null>(null);

  useEffect(() => {
    if (fromQuery.length === 3) setDeparture(fromQuery);
  }, [fromQuery]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p: ClientProfile | null = await fetchProfile();
      if (cancelled) return;
      setProfileReady(true);
      if (!p) return;
      setDeparture((d) => d || p.homeAirport.trim().toUpperCase());
      setAdults(p.familyAdults);
      setChildren(p.familyChildren);
      const pref = p.preferredCabin;
      if (
        pref === "economy" ||
        pref === "premium_economy" ||
        pref === "business" ||
        pref === "first"
      ) {
        setCabin(pref);
      } else {
        setCabin("economy");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runSearch = useCallback(async () => {
    setError(null);
    setMeta(null);
    setDestinations(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        departureId: departure.trim(),
        tripType,
        dateMode,
        adults,
        children,
        cabinClass: cabin,
      };
      if (dateMode === "calendar") {
        body.outboundDate = outboundDate;
        if (tripType === "round_trip") body.returnDate = returnDate;
      } else {
        body.month = month;
        body.travelDuration = travelDuration;
      }

      const res = await fetch("/api/explore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json()) as
        | {
            source: string;
            currency: string;
            googleExploreUrl: string | null;
            destinations: Destination[];
            error?: string;
          }
        | { error: string };
      if (!res.ok) {
        setError(
          "error" in j && typeof j.error === "string" ? j.error : "Search failed."
        );
        return;
      }
      if (!("destinations" in j)) {
        setError("Unexpected response.");
        return;
      }
      setMeta({
        source: j.source,
        currency: j.currency,
        googleExploreUrl: j.googleExploreUrl,
      });
      setDestinations(j.destinations);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [
    departure,
    tripType,
    dateMode,
    month,
    travelDuration,
    outboundDate,
    returnDate,
    adults,
    children,
    cabin,
  ]);

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-3 border-b border-stone-200/90 pb-8">
          <Link
            href="/"
            className="text-sm font-semibold text-rose-600 underline-offset-4 hover:text-rose-700 hover:underline"
          >
            ← Trips
          </Link>
          <h1
            className={`${sectionTitle} text-3xl tracking-tight`}
          >
            Explore options
          </h1>
          <p className="max-w-xl text-sm leading-[1.65] text-stone-500">
            Browse where Google Travel Explore would take you from your home
            airport — either with{" "}
            <strong className="font-semibold text-stone-700">
              a month and trip length
            </strong>{" "}
            (like a week in April) or{" "}
            <strong className="font-semibold text-stone-700">
              fixed departure and return dates
            </strong>
            . Results are powered by SerpAPI when configured; otherwise you&apos;ll
            see sample rows.
          </p>
        </header>

        <section className={`${panelClass} flex flex-col gap-5`}>
          <h2 className={sectionTitle}>Search</h2>
          {!profileReady ? (
            <p className="text-sm text-stone-500">Loading your profile…</p>
          ) : null}

          <label className="flex flex-col gap-2 text-sm">
            <span className={labelClass}>From (IATA airport)</span>
            <input
              value={departure}
              onChange={(e) => setDeparture(e.target.value.toUpperCase())}
              placeholder="SEA"
              maxLength={3}
              className={`${inputClass} font-mono uppercase`}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTripType("round_trip")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                tripType === "round_trip"
                  ? "bg-rose-600 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Round trip
            </button>
            <button
              type="button"
              onClick={() => setTripType("one_way")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                tripType === "one_way"
                  ? "bg-rose-600 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              One way
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDateMode("flexible")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                dateMode === "flexible"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Flexible (month + length)
            </button>
            <button
              type="button"
              onClick={() => setDateMode("calendar")}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                dateMode === "calendar"
                  ? "bg-stone-900 text-white"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200"
              }`}
            >
              Exact dates
            </button>
          </div>

          {dateMode === "flexible" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className={labelClass}>Month</span>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number.parseInt(e.target.value, 10))}
                  className={inputClass}
                >
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-stone-400">
                  Google only considers trips in the upcoming months window
                  (see SerpAPI docs).
                </span>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className={labelClass}>Trip length</span>
                <select
                  value={travelDuration}
                  onChange={(e) =>
                    setTravelDuration(Number.parseInt(e.target.value, 10))
                  }
                  className={inputClass}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                <span className={labelClass}>Depart</span>
                <input
                  type="date"
                  value={outboundDate}
                  onChange={(e) => setOutboundDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              {tripType === "round_trip" ? (
                <label className="flex flex-col gap-2 text-sm">
                  <span className={labelClass}>Return</span>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className={inputClass}
                  />
                </label>
              ) : null}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm">
              <span className={labelClass}>Adults</span>
              <input
                type="number"
                min={1}
                max={9}
                value={adults}
                onChange={(e) =>
                  setAdults(
                    Math.min(
                      9,
                      Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    )
                  )
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className={labelClass}>Children</span>
              <input
                type="number"
                min={0}
                max={8}
                value={children}
                onChange={(e) =>
                  setChildren(
                    Math.min(
                      8,
                      Math.max(0, Number.parseInt(e.target.value, 10) || 0)
                    )
                  )
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className={labelClass}>Cabin</span>
              <select
                value={cabin}
                onChange={(e) => setCabin(e.target.value)}
                className={inputClass}
              >
                {CABIN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={
              loading ||
              departure.trim().length !== 3 ||
              (dateMode === "calendar" &&
                (!outboundDate ||
                  (tripType === "round_trip" && !returnDate)))
            }
            onClick={() => void runSearch()}
            className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
          >
            {loading ? "Searching…" : "Explore destinations"}
          </button>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </section>

        {meta && destinations && destinations.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle}>Results</h2>
              <div className="flex flex-wrap items-center gap-2">
                {meta.source === "demo" ? (
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900/90 ring-1 ring-amber-100">
                    Demo — add SerpAPI key for live Explore
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-900/90 ring-1 ring-emerald-100">
                    Google Travel Explore (SerpAPI)
                  </span>
                )}
                {meta.googleExploreUrl ? (
                  <a
                    href={meta.googleExploreUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-rose-600 underline-offset-2 hover:underline"
                  >
                    Open on Google Travel →
                  </a>
                ) : null}
              </div>
            </div>
            <p className="text-xs leading-relaxed text-stone-400">
              Prices and dates come from Google&apos;s explore model; party size{" "}
              {adults} adult{adults !== 1 ? "s" : ""}
              {children > 0
                ? `, ${children} child${children !== 1 ? "ren" : ""}`
                : ""}{" "}
              · {cabinLabel(cabin)}. Tap a card to open the matching view on
              Google.
            </p>
            <ul className="grid gap-4 sm:grid-cols-2">
              {destinations.map((d) => (
                <li key={d.destinationId}>
                  <a
                    href={d.googleTravelUrl ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${panelClass} flex h-full flex-col gap-3 transition-shadow hover:shadow-md`}
                  >
                    <div className="flex gap-3">
                      <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-lg bg-stone-200">
                        {d.thumbnail ? (
                          <img
                            src={d.thumbnail}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-stone-100 text-lg font-semibold text-rose-800/80">
                            {d.name.slice(0, 1)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-stone-900">{d.name}</p>
                        <p className="text-sm text-stone-500">{d.country}</p>
                        {d.airportCode ? (
                          <p className="mt-1 font-mono text-xs text-stone-400">
                            {d.airportCode}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-stone-100 pt-3 text-sm">
                      <span className="text-lg font-semibold text-stone-900">
                        {d.flightPrice != null
                          ? `${meta.currency} ${d.flightPrice}`
                          : "—"}
                      </span>
                      {d.startDate ? (
                        <span className="text-xs text-stone-500">
                          {d.startDate}
                          {d.endDate && d.endDate !== d.startDate
                            ? ` → ${d.endDate}`
                            : ""}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-stone-500">
                      {formatDurationMinutes(d.flightDurationMinutes)} flight
                      {d.stops != null ? ` · ${stopsLabel(d.stops)}` : ""}
                      {d.airline ? ` · ${d.airline}` : ""}
                      {d.hotelPrice != null
                        ? ` · hotel from ${meta.currency} ${d.hotelPrice}`
                        : ""}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      <SubmitHangarOverlay
        open={loading}
        message="Fetching explore destinations…"
      />
    </>
  );
}
