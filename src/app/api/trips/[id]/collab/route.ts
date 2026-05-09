import { NextResponse } from "next/server";
import { getFirestoreDb } from "@/lib/firebase-server";
import { optionalCollabViewerKey, resolveCollabActor } from "@/lib/collab-actor";
import {
  addUserChatMessage,
  appendTripActivity,
  createProposal,
  listChatMessages,
  listProposals,
  normalizeProposalIata,
  toggleProposalVote,
} from "@/lib/firestore-trip-collab";
import { tripExists } from "@/lib/firestore-trips";

type Ctx = { params: Promise<{ id: string }> };

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request, ctx: Ctx) {
  const { id: tripId } = await ctx.params;
  if (!(await tripExists(tripId))) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  const viewerKey = await optionalCollabViewerKey(req);
  const [messages, proposals] = await Promise.all([
    listChatMessages(tripId),
    listProposals(tripId, viewerKey),
  ]);
  return NextResponse.json({ messages, proposals });
}

export async function POST(req: Request, ctx: Ctx) {
  const { id: tripId } = await ctx.params;
  if (!(await tripExists(tripId))) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const resolved = await resolveCollabActor(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }
  const { actor } = resolved;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const action = typeof b.action === "string" ? b.action : "";

  if (action === "message") {
    const text = typeof b.text === "string" ? b.text : "";
    if (!text.trim()) {
      return NextResponse.json({ error: "Message text is required." }, { status: 400 });
    }
    await addUserChatMessage(tripId, actor, text);
    return NextResponse.json({ ok: true });
  }

  if (action === "proposal") {
    const kind = b.kind === "dates" ? "dates" : "destination";
    let label = typeof b.label === "string" ? b.label.trim() : "";
    if (kind === "dates" && !label) label = "Trip dates";
    if (!label || label.length > 500) {
      return NextResponse.json(
        { error: "Proposal label is required (max 500 characters)." },
        { status: 400 }
      );
    }
    let iata: string | null = null;
    let dateStart: string | null = null;
    let dateEnd: string | null = null;

    if (kind === "destination") {
      const rawIata =
        typeof b.iata === "string" && b.iata.trim()
          ? b.iata
          : typeof b.destinationCode === "string"
            ? b.destinationCode
            : "";
      iata = normalizeProposalIata(rawIata);
    } else {
      dateStart =
        typeof b.dateStart === "string" ? b.dateStart.trim() : "";
      dateEnd = typeof b.dateEnd === "string" ? b.dateEnd.trim() : "";
      if (!dateStart || !dateRe.test(dateStart)) {
        return NextResponse.json(
          { error: "dateStart (YYYY-MM-DD) is required for date proposals." },
          { status: 400 }
        );
      }
      if (dateEnd && !dateRe.test(dateEnd)) {
        return NextResponse.json(
          { error: "dateEnd must be YYYY-MM-DD when provided." },
          { status: 400 }
        );
      }
      if (!dateEnd) dateEnd = null;
    }

    const created = await createProposal(tripId, actor, {
      kind,
      label,
      iata,
      dateStart,
      dateEnd,
    });

    if (kind === "destination") {
      const line = iata
        ? `${actor.displayName} proposed a place: ${label} (${iata})`
        : `${actor.displayName} proposed a place: ${label}`;
      await appendTripActivity(tripId, line);
    } else {
      const range =
        dateEnd && dateEnd !== dateStart
          ? `${dateStart} → ${dateEnd}`
          : dateStart;
      await appendTripActivity(
        tripId,
        `${actor.displayName} proposed dates: ${range}`
      );
    }

    return NextResponse.json({ ok: true, proposal: created });
  }

  if (action === "vote") {
    const proposalId =
      typeof b.proposalId === "string" ? b.proposalId.trim() : "";
    if (!proposalId) {
      return NextResponse.json(
        { error: "proposalId is required." },
        { status: 400 }
      );
    }
    const pRef = getFirestoreDb()
      .collection("trips")
      .doc(tripId)
      .collection("proposals")
      .doc(proposalId);
    const pSnap = await pRef.get();
    if (!pSnap.exists) {
      return NextResponse.json({ error: "Proposal not found." }, { status: 404 });
    }
    const result = await toggleProposalVote(tripId, proposalId, actor);
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json(
    { error: "Unknown action. Use message, proposal, or vote." },
    { status: 400 }
  );
}
