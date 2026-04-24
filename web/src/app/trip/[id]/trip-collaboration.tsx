"use client";

import { useCallback, useEffect, useState } from "react";
import { collabJsonHeaders, collabRequestHeaders } from "@/lib/trips-client";

const inputClass =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-stone-900 shadow-sm placeholder:text-stone-400 transition-colors focus:border-rose-300 focus:outline-none focus:ring-4 focus:ring-rose-100/70";

const labelClass = "font-medium text-stone-700";

const panelClass =
  "rounded-2xl border border-stone-200/80 bg-white p-4 shadow-[0_1px_3px_rgb(15_15_15/0.04)] sm:p-5";

const sectionTitle =
  "font-[family-name:var(--font-source-serif)] text-xl font-normal text-stone-900";

export type TripBriefState = {
  purpose: string;
  budgetNotes: string;
  constraintsNotes: string;
  dateEarliest: string;
  dateLatest: string;
};

type ChatMessage = {
  id: string;
  kind: "user" | "system";
  text: string;
  actorKey: string | null;
  actorName: string;
  createdAt: string | null;
};

type Proposal = {
  id: string;
  kind: "destination" | "dates";
  label: string;
  iata: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  createdByName: string;
  voteCount: number;
  votedByMe: boolean;
};

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function TripBriefSection({
  tripId,
  brief,
  onUpdated,
}: {
  tripId: string;
  brief: TripBriefState;
  onUpdated?: (b: TripBriefState) => void;
}) {
  const [purpose, setPurpose] = useState(brief.purpose);
  const [budgetNotes, setBudgetNotes] = useState(brief.budgetNotes);
  const [constraintsNotes, setConstraintsNotes] = useState(
    brief.constraintsNotes
  );
  const [dateEarliest, setDateEarliest] = useState(brief.dateEarliest);
  const [dateLatest, setDateLatest] = useState(brief.dateLatest);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPurpose(brief.purpose);
    setBudgetNotes(brief.budgetNotes);
    setConstraintsNotes(brief.constraintsNotes);
    setDateEarliest(brief.dateEarliest);
    setDateLatest(brief.dateLatest);
  }, [brief]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefPurpose: purpose,
          briefBudget: budgetNotes,
          briefConstraints: constraintsNotes,
          briefDateEarliest: dateEarliest,
          briefDateLatest: dateLatest,
        }),
      });
      const j = (await res.json()) as { error?: string; brief?: TripBriefState };
      if (!res.ok) {
        setError(j.error ?? "Could not save brief.");
        return;
      }
      if (j.brief) {
        onUpdated?.(j.brief);
      }
    } finally {
      setSaving(false);
    }
  }, [
    tripId,
    purpose,
    budgetNotes,
    constraintsNotes,
    dateEarliest,
    dateLatest,
    onUpdated,
  ]);

  return (
    <section className="flex flex-col gap-5">
      <h2 className={sectionTitle}>Trip brief</h2>
      <p className="text-sm leading-[1.65] text-stone-500">
        Shared context for your group: why you&apos;re going, budget band,
        constraints, and a rough date window. Anyone with the link can edit.
      </p>
      <div className={`${panelClass} flex flex-col gap-4`}>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <label className="flex flex-col gap-2 text-sm">
          <span className={labelClass}>Purpose / vibe</span>
          <textarea
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            rows={3}
            placeholder="Family reunion, ski week, keep flights under 3 hours…"
            className={`${inputClass} min-h-[5rem] resize-y`}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className={labelClass}>Budget notes</span>
          <textarea
            value={budgetNotes}
            onChange={(e) => setBudgetNotes(e.target.value)}
            rows={2}
            placeholder="Rough total, per-person cap, use points, etc."
            className={`${inputClass} min-h-[4rem] resize-y`}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className={labelClass}>Constraints</span>
          <textarea
            value={constraintsNotes}
            onChange={(e) => setConstraintsNotes(e.target.value)}
            rows={2}
            placeholder="School breaks only, accessibility, no redeyes…"
            className={`${inputClass} min-h-[4rem] resize-y`}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className={labelClass}>Earliest date</span>
            <input
              type="date"
              value={dateEarliest}
              onChange={(e) => setDateEarliest(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className={labelClass}>Latest date</span>
            <input
              type="date"
              value={dateLatest}
              onChange={(e) => setDateLatest(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="w-fit rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-stone-800 disabled:opacity-45"
        >
          {saving ? "Saving…" : "Save brief"}
        </button>
      </div>
    </section>
  );
}

export function TripGroupPlanSection({ tripId }: { tripId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatText, setChatText] = useState("");
  const [posting, setPosting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [placeLabel, setPlaceLabel] = useState("");
  const [placeIata, setPlaceIata] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [datesLabel, setDatesLabel] = useState("");

  const load = useCallback(async () => {
    const headers = await collabRequestHeaders();
    const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collab`, {
      headers,
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const j = (await res.json()) as {
      messages?: ChatMessage[];
      proposals?: Proposal[];
    };
    setMessages(j.messages ?? []);
    setProposals(j.proposals ?? []);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [load]);

  const sendChat = useCallback(async () => {
    const text = chatText.trim();
    if (!text) return;
    setPosting(true);
    setChatError(null);
    try {
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collab`, {
        method: "POST",
        headers: await collabJsonHeaders(),
        body: JSON.stringify({ action: "message", text }),
      });
      if (res.status === 401) {
        setChatError(
          "Sign in or use a saved guest profile (Profile / onboarding) to post messages."
        );
        return;
      }
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setChatError(j.error ?? "Could not send.");
        return;
      }
      setChatText("");
      await load();
    } finally {
      setPosting(false);
    }
  }, [chatText, tripId, load]);

  const addProposal = useCallback(
    async (kind: "destination" | "dates") => {
      setPosting(true);
      setChatError(null);
      try {
        const body =
          kind === "destination"
            ? {
                action: "proposal",
                kind: "destination",
                label: placeLabel.trim(),
                iata: placeIata.trim() || undefined,
              }
            : {
                action: "proposal",
                kind: "dates",
                label: datesLabel.trim() || undefined,
                dateStart: dateStart.trim(),
                dateEnd: dateEnd.trim() || undefined,
              };
        const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collab`, {
          method: "POST",
          headers: await collabJsonHeaders(),
          body: JSON.stringify(body),
        });
        if (res.status === 401) {
          setChatError(
            "Sign in or use a saved guest profile to add proposals."
          );
          return;
        }
        if (!res.ok) {
          const j = (await res.json()) as { error?: string };
          setChatError(j.error ?? "Could not add proposal.");
          return;
        }
        if (kind === "destination") {
          setPlaceLabel("");
          setPlaceIata("");
        } else {
          setDateStart("");
          setDateEnd("");
          setDatesLabel("");
        }
        await load();
      } finally {
        setPosting(false);
      }
    },
    [tripId, placeLabel, placeIata, dateStart, dateEnd, datesLabel, load]
  );

  const toggleVote = useCallback(
    async (proposalId: string) => {
      setChatError(null);
      const res = await fetch(`/api/trips/${encodeURIComponent(tripId)}/collab`, {
        method: "POST",
        headers: await collabJsonHeaders(),
        body: JSON.stringify({ action: "vote", proposalId }),
      });
      if (res.status === 401) {
        setChatError("Sign in or use a saved guest profile to vote.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setChatError(j.error ?? "Vote failed.");
        return;
      }
      await load();
    },
    [tripId, load]
  );

  return (
    <section className="flex flex-col gap-5">
      <h2 className={sectionTitle}>Group plan & chat</h2>
      <p className="text-sm leading-[1.65] text-stone-500">
        Discuss options here, propose places or date ranges, and vote. Trip
        activity (like someone joining) appears in the feed automatically.
      </p>

      <div className={`${panelClass} flex flex-col gap-5`}>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Proposals
          </p>
          {loading ? (
            <p className="mt-2 text-sm text-stone-500">Loading…</p>
          ) : proposals.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              No proposals yet — add a place or dates below.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {proposals.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      {p.kind === "destination" ? (
                        <>
                          {p.label}
                          {p.iata ? (
                            <span className="ml-1.5 font-mono text-stone-600">
                              {p.iata}
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {p.dateStart}
                          {p.dateEnd && p.dateEnd !== p.dateStart
                            ? ` → ${p.dateEnd}`
                            : null}
                          {p.label && p.label !== "Trip dates" ? (
                            <span className="ml-1.5 font-normal text-stone-600">
                              · {p.label}
                            </span>
                          ) : null}
                        </>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      by {p.createdByName} · {p.voteCount} vote
                      {p.voteCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={posting}
                    onClick={() => void toggleVote(p.id)}
                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
                      p.votedByMe
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "border border-stone-200 bg-white text-stone-800 hover:border-stone-300"
                    }`}
                  >
                    {p.votedByMe ? "Voted" : "Vote"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-4 border-t border-stone-200/90 pt-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-stone-700">
              Propose a place
            </p>
            <input
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              placeholder="City or nickname"
              className={inputClass}
            />
            <input
              value={placeIata}
              onChange={(e) => setPlaceIata(e.target.value.toUpperCase())}
              placeholder="Airport code (optional)"
              maxLength={3}
              className={`${inputClass} font-mono`}
            />
            <button
              type="button"
              disabled={posting || !placeLabel.trim()}
              onClick={() => void addProposal("destination")}
              className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-45"
            >
              Add place
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-stone-700">
              Propose dates
            </p>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className={inputClass}
            />
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className={inputClass}
            />
            <input
              value={datesLabel}
              onChange={(e) => setDatesLabel(e.target.value)}
              placeholder="Label (optional)"
              className={inputClass}
            />
            <button
              type="button"
              disabled={posting || !dateStart.trim()}
              onClick={() => void addProposal("dates")}
              className="rounded-lg bg-stone-900 px-3 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-45"
            >
              Add dates
            </button>
          </div>
        </div>

        <div className="border-t border-stone-200/90 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
            Activity & messages
          </p>
          <div className="mt-3 flex max-h-[min(24rem,50vh)] flex-col gap-2 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/50 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-stone-500">
                No messages yet. Say hi or add a proposal above.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    m.kind === "system"
                      ? "bg-amber-50/90 text-amber-950/90 ring-1 ring-amber-100/80"
                      : "bg-white text-stone-800 ring-1 ring-stone-100"
                  }`}
                >
                  {m.kind === "user" ? (
                    <p className="text-[11px] font-semibold text-stone-500">
                      {m.actorName}
                      {m.createdAt ? (
                        <span className="ml-2 font-normal text-stone-400">
                          {formatWhen(m.createdAt)}
                        </span>
                      ) : null}
                    </p>
                  ) : (
                    <p className="text-[11px] font-semibold text-amber-800/80">
                      Activity
                      {m.createdAt ? (
                        <span className="ml-2 font-normal text-amber-800/60">
                          {formatWhen(m.createdAt)}
                        </span>
                      ) : null}
                    </p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">
                    {m.text}
                  </p>
                </div>
              ))
            )}
          </div>
          {chatError ? (
            <p className="mt-2 text-sm text-red-600" role="alert">
              {chatError}
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <textarea
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Message the group…"
              rows={2}
              className={`${inputClass} min-h-[3.5rem] flex-1 resize-y sm:min-h-[2.75rem]`}
            />
            <button
              type="button"
              disabled={posting || !chatText.trim()}
              onClick={() => void sendChat()}
              className="rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45 sm:shrink-0"
            >
              {posting ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
