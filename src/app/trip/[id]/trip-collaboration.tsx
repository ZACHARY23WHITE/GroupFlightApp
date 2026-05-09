"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { collabJsonHeaders, collabRequestHeaders } from "@/lib/trips-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  kind: "user" | "system";
  text: string;
  actorKey: string | null;
  actorName: string;
  createdAt: string | null;
};

export type Proposal = {
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

type CollabData = {
  messages: ChatMessage[];
  proposals: Proposal[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function friendlyDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function useCollabData(tripId: string) {
  const [data, setData] = useState<CollabData>({ messages: [], proposals: [] });
  const [actorKey, setActorKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const headers = await collabRequestHeaders();
    const params = new URLSearchParams();
    if (headers["X-Profile-Id"]) params.set("profileId", headers["X-Profile-Id"]);
    const res = await fetch(
      `/api/trips/${tripId}/collab?${params.toString()}`,
      { headers }
    );
    if (!res.ok) return;
    const j = (await res.json()) as {
      messages?: ChatMessage[];
      proposals?: Proposal[];
      actorKey?: string | null;
    };
    setData({
      messages: j.messages ?? [],
      proposals: j.proposals ?? [],
    });
    if (j.actorKey !== undefined) setActorKey(j.actorKey ?? null);
  }, [tripId]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 8000);
    return () => clearInterval(id);
  }, [refresh]);

  return { data, actorKey, refresh };
}

// ─── VoteBar ──────────────────────────────────────────────────────────────────

function VoteBar({ count, max }: { count: number; max: number }) {
  const pct = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-rose-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-12 text-right text-[11px] font-medium text-stone-400">
        {count} vote{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ─── DestinationPoll ──────────────────────────────────────────────────────────

export function DestinationPoll({
  tripId,
  votingOpen,
}: {
  tripId: string;
  votingOpen: boolean;
}) {
  const { data, actorKey, refresh } = useCollabData(tripId);
  const proposals = data.proposals.filter((p) => p.kind === "destination");
  const maxVotes = Math.max(0, ...proposals.map((p) => p.voteCount));

  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [iata, setIata] = useState("");
  const [busy, setBusy] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const submit = useCallback(async () => {
    if (!label.trim()) return;
    setBusy(true);
    try {
      const headers = await collabJsonHeaders();
      await fetch(`/api/trips/${tripId}/collab`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "proposal",
          kind: "destination",
          label: label.trim(),
          iata: iata.trim().toUpperCase() || null,
        }),
      });
      setLabel("");
      setIata("");
      setShowForm(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [tripId, label, iata, refresh]);

  const vote = useCallback(
    async (proposalId: string) => {
      setVotingId(proposalId);
      try {
        const headers = await collabJsonHeaders();
        await fetch(`/api/trips/${tripId}/collab`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "vote", proposalId }),
        });
        await refresh();
      } finally {
        setVotingId(null);
      }
    },
    [tripId, refresh]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">Destination ideas</h3>
        {votingOpen && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-rose-600 underline-offset-2 hover:underline"
          >
            + Suggest a place
          </button>
        ) : null}
      </div>

      {proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-400">
          No destination ideas yet.{" "}
          {votingOpen ? "Be the first to suggest one!" : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {proposals
            .slice()
            .sort((a, b) => b.voteCount - a.voteCount)
            .map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-stone-200/90 bg-stone-50/50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{p.label}</p>
                    {p.iata ? (
                      <p className="font-mono text-xs text-stone-400">{p.iata}</p>
                    ) : null}
                    <VoteBar count={p.voteCount} max={maxVotes} />
                  </div>
                  {votingOpen && actorKey ? (
                    <button
                      type="button"
                      disabled={votingId === p.id}
                      onClick={() => void vote(p.id)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        p.votedByMe
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "border border-stone-200 bg-white text-stone-700 hover:border-rose-200 hover:bg-rose-50/60 hover:text-rose-700"
                      }`}
                    >
                      {p.votedByMe ? "Voted ✓" : "Vote"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-4">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="City or country name"
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <input
            value={iata}
            onChange={(e) => setIata(e.target.value.toUpperCase())}
            placeholder="Airport code (optional, e.g. CDG)"
            maxLength={3}
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 font-mono text-sm uppercase text-stone-900 placeholder:normal-case placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !label.trim()}
              onClick={() => void submit()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
            >
              {busy ? "Adding…" : "Add suggestion"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setLabel("");
                setIata("");
              }}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── DatePoll ─────────────────────────────────────────────────────────────────

export function DatePoll({
  tripId,
  votingOpen,
}: {
  tripId: string;
  votingOpen: boolean;
}) {
  const { data, actorKey, refresh } = useCollabData(tripId);
  const proposals = data.proposals.filter((p) => p.kind === "dates");
  const maxVotes = Math.max(0, ...proposals.map((p) => p.voteCount));

  const [showForm, setShowForm] = useState(false);
  const [dateLabel, setDateLabel] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const autoLabel = useCallback(() => {
    if (!dateLabel.trim() && dateStart && dateEnd) {
      try {
        const s = new Date(dateStart + "T00:00:00");
        const e = new Date(dateEnd + "T00:00:00");
        const fmt = (d: Date) =>
          d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
        setDateLabel(`${fmt(s)} – ${fmt(e)}`);
      } catch {
        /* ignore */
      }
    }
  }, [dateLabel, dateStart, dateEnd]);

  const submit = useCallback(async () => {
    if (!dateStart || !dateEnd) return;
    setBusy(true);
    const label = dateLabel.trim() || `${dateStart} – ${dateEnd}`;
    try {
      const headers = await collabJsonHeaders();
      await fetch(`/api/trips/${tripId}/collab`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "proposal",
          kind: "dates",
          label,
          dateStart,
          dateEnd,
        }),
      });
      setDateLabel("");
      setDateStart("");
      setDateEnd("");
      setShowForm(false);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [tripId, dateLabel, dateStart, dateEnd, refresh]);

  const vote = useCallback(
    async (proposalId: string) => {
      setVotingId(proposalId);
      try {
        const headers = await collabJsonHeaders();
        await fetch(`/api/trips/${tripId}/collab`, {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "vote", proposalId }),
        });
        await refresh();
      } finally {
        setVotingId(null);
      }
    },
    [tripId, refresh]
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">When can everyone go?</h3>
        {votingOpen && !showForm ? (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="text-xs font-semibold text-rose-600 underline-offset-2 hover:underline"
          >
            + Suggest dates
          </button>
        ) : null}
      </div>

      {proposals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-200 px-4 py-5 text-center text-sm text-stone-400">
          No date ideas yet.{" "}
          {votingOpen ? "Suggest when you're free!" : ""}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {proposals
            .slice()
            .sort((a, b) => b.voteCount - a.voteCount)
            .map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-stone-200/90 bg-stone-50/50 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-900">{p.label}</p>
                    {p.dateStart && p.dateEnd ? (
                      <p className="text-xs text-stone-400">
                        {friendlyDate(p.dateStart)} → {friendlyDate(p.dateEnd)}
                      </p>
                    ) : null}
                    <VoteBar count={p.voteCount} max={maxVotes} />
                  </div>
                  {votingOpen && actorKey ? (
                    <button
                      type="button"
                      disabled={votingId === p.id}
                      onClick={() => void vote(p.id)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        p.votedByMe
                          ? "bg-rose-600 text-white hover:bg-rose-700"
                          : "border border-stone-200 bg-white text-stone-700 hover:border-rose-200 hover:bg-rose-50/60 hover:text-rose-700"
                      }`}
                    >
                      {p.votedByMe ? "Voted ✓" : "Vote"}
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
        </ul>
      )}

      {showForm ? (
        <div className="flex flex-col gap-2 rounded-xl border border-rose-100 bg-rose-50/40 p-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              From
              <input
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                onBlur={autoLabel}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              To
              <input
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                onBlur={autoLabel}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
            </label>
          </div>
          <input
            value={dateLabel}
            onChange={(e) => setDateLabel(e.target.value)}
            placeholder='Label (optional, e.g. "Spring break")'
            className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !dateStart || !dateEnd}
              onClick={() => void submit()}
              className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
            >
              {busy ? "Adding…" : "Add dates"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setDateLabel("");
                setDateStart("");
                setDateEnd("");
              }}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── ChatSection ──────────────────────────────────────────────────────────────

export function ChatSection({ tripId }: { tripId: string }) {
  const { data, actorKey, refresh } = useCollabData(tripId);
  const messages = data.messages;

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = useCallback(async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const headers = await collabJsonHeaders();
      await fetch(`/api/trips/${tripId}/collab`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "message", text: text.trim() }),
      });
      setText("");
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [tripId, text, refresh]);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-stone-700">Group chat</h3>
      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto rounded-xl border border-stone-200/90 bg-stone-50/40 p-3">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-stone-400">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((m) =>
            m.kind === "system" ? (
              <p key={m.id} className="py-1 text-center text-[11px] text-stone-400">
                {m.text}
              </p>
            ) : (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.actorKey === actorKey ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                    m.actorKey === actorKey
                      ? "bg-rose-600 text-white"
                      : "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80"
                  }`}
                >
                  {m.actorKey !== actorKey ? (
                    <p className="mb-0.5 text-[10px] font-semibold text-stone-400">
                      {m.actorName}
                    </p>
                  ) : null}
                  <p className="text-sm leading-snug">{m.text}</p>
                </div>
              </div>
            )
          )
        )}
        <div ref={bottomRef} />
      </div>
      {actorKey ? (
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Message the group…"
            className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-100"
          />
          <button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => void send()}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-45"
          >
            Send
          </button>
        </div>
      ) : (
        <p className="text-xs text-stone-400">
          Save your profile to join the chat.
        </p>
      )}
    </div>
  );
}
