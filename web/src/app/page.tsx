"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/80";

export default function Home() {
  const router = useRouter();
  const [tripName, setTripName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createTrip = useCallback(async () => {
    setError(null);
    setBusy("create");
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tripName.trim() || "Family trip" }),
      });
      let j: { id?: string; error?: string };
      try {
        j = (await res.json()) as { id?: string; error?: string };
      } catch {
        setError(
          "The server returned an invalid response. If you opened this site from a phone using the Network URL, set NEXT_DEV_ALLOWED_ORIGINS in .env to your computer’s IP and restart `npm run dev`."
        );
        return;
      }
      if (!res.ok) {
        setError(j.error ?? "Could not create trip.");
        return;
      }
      if (j.id) router.push(`/trip/${j.id}`);
    } catch {
      setError(
        "Could not reach the server. Use http://localhost:3000 on this Mac, or add your LAN IP to NEXT_DEV_ALLOWED_ORIGINS (see .env.example) and restart the dev server."
      );
    } finally {
      setBusy(null);
    }
  }, [router, tripName]);

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
        setError(
          "Bad response from server. Try http://localhost:3000 or fix NEXT_DEV_ALLOWED_ORIGINS (see .env)."
        );
        return;
      }
      if (!res.ok) {
        setError(j.error ?? "Could not find that code.");
        return;
      }
      if (j.id) router.push(`/trip/${j.id}`);
    } catch {
      setError(
        "Could not reach the server. Use localhost:3000 on this machine, or configure NEXT_DEV_ALLOWED_ORIGINS for your LAN IP."
      );
    } finally {
      setBusy(null);
    }
  }, [router, joinCode]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_60%_at_50%_-15%,rgb(255_228_230/0.45),transparent)]"
        aria-hidden
      />
      <main className="relative mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-10 px-4 py-16 sm:gap-12 sm:px-6">
        <div className="flex flex-col gap-4 text-center sm:text-left">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Gather · Plan · Go
          </p>
          <h1 className="font-[family-name:var(--font-source-serif)] text-[2rem] font-normal leading-tight tracking-tight text-stone-900 sm:text-[2.25rem]">
            Plan together, compare fares
          </h1>
          <p className="text-base leading-[1.65] text-stone-500">
            Start a shared trip, add each person&apos;s home airport, then see
            what it costs everyone to fly into the same destination.
          </p>
        </div>

        {error ? (
          <p
            className="rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm leading-relaxed text-red-800 shadow-sm"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <section className="flex flex-col gap-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_3px_rgb(15_15_15/0.04),0_4px_24px_rgb(15_15_15/0.03)] sm:p-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            New trip
          </h2>
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

        <section className="flex flex-col gap-5 rounded-2xl border border-stone-200/80 bg-white p-6 shadow-[0_1px_3px_rgb(15_15_15/0.04),0_4px_24px_rgb(15_15_15/0.03)] sm:p-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Join a trip
          </h2>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-stone-700">Invite code</span>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. K7M2NP9Q"
              className={`${inputClass} font-mono tracking-[0.2em]`}
            />
          </label>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void joinTrip()}
            className="rounded-xl border border-stone-200 bg-stone-50/80 py-3 text-sm font-semibold text-stone-800 shadow-sm transition-colors hover:border-stone-300 hover:bg-white disabled:opacity-45"
          >
            {busy === "join" ? "Opening…" : "Join trip"}
          </button>
        </section>
      </main>
    </div>
  );
}
