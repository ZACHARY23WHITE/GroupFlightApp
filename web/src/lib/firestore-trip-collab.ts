import * as admin from "firebase-admin";
import { nanoid } from "nanoid";
import { getFirestoreDb } from "@/lib/firebase-server";
import { normalizeIata } from "@/lib/iata";

const FieldValue = admin.firestore.FieldValue;

const tripsCollection = () => getFirestoreDb().collection("trips");

export type TripBriefDto = {
  purpose: string;
  budgetNotes: string;
  constraintsNotes: string;
  dateEarliest: string;
  dateLatest: string;
};

export function emptyTripBrief(): TripBriefDto {
  return {
    purpose: "",
    budgetNotes: "",
    constraintsNotes: "",
    dateEarliest: "",
    dateLatest: "",
  };
}

export function briefFromTripDoc(
  data: FirebaseFirestore.DocumentData | undefined
): TripBriefDto {
  if (!data) return emptyTripBrief();
  return {
    purpose: String(data.briefPurpose ?? ""),
    budgetNotes: String(data.briefBudget ?? ""),
    constraintsNotes: String(data.briefConstraints ?? ""),
    dateEarliest: String(data.briefDateEarliest ?? ""),
    dateLatest: String(data.briefDateLatest ?? ""),
  };
}

export async function updateTripBrief(
  tripId: string,
  brief: TripBriefDto
): Promise<boolean> {
  const ref = tripsCollection().doc(tripId);
  const doc = await ref.get();
  if (!doc.exists) return false;
  await ref.update({
    briefPurpose: brief.purpose.slice(0, 4000),
    briefBudget: brief.budgetNotes.slice(0, 2000),
    briefConstraints: brief.constraintsNotes.slice(0, 2000),
    briefDateEarliest: brief.dateEarliest.slice(0, 32),
    briefDateLatest: brief.dateLatest.slice(0, 32),
  });
  return true;
}

export type ChatMessageDto = {
  id: string;
  kind: "user" | "system";
  text: string;
  actorKey: string | null;
  actorName: string;
  createdAt: string | null;
};

export type ProposalDto = {
  id: string;
  kind: "destination" | "dates";
  label: string;
  iata: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  createdByKey: string;
  createdByName: string;
  createdAt: string | null;
  voteCount: number;
  votedByMe: boolean;
};

function tsIso(
  v: FirebaseFirestore.Timestamp | Date | string | undefined | null
): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof (v as FirebaseFirestore.Timestamp).toDate === "function") {
    return (v as FirebaseFirestore.Timestamp).toDate().toISOString();
  }
  return null;
}

const CHAT_LIMIT = 120;

export async function appendTripActivity(
  tripId: string,
  text: string
): Promise<void> {
  const ref = tripsCollection().doc(tripId);
  const doc = await ref.get();
  if (!doc.exists) return;
  await ref.collection("chatMessages").add({
    kind: "system",
    text: text.slice(0, 4000),
    actorKey: null,
    actorName: "Trip",
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function addUserChatMessage(
  tripId: string,
  actor: { key: string; displayName: string },
  text: string
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await tripsCollection().doc(tripId).collection("chatMessages").add({
    kind: "user",
    text: trimmed.slice(0, 4000),
    actorKey: actor.key,
    actorName: actor.displayName.slice(0, 120),
    createdAt: FieldValue.serverTimestamp(),
  });
}

export async function listChatMessages(
  tripId: string
): Promise<ChatMessageDto[]> {
  const snap = await tripsCollection()
    .doc(tripId)
    .collection("chatMessages")
    .orderBy("createdAt", "desc")
    .limit(CHAT_LIMIT)
    .get();
  const rows: ChatMessageDto[] = snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      kind: x.kind === "system" ? "system" : "user",
      text: String(x.text ?? ""),
      actorKey: typeof x.actorKey === "string" ? x.actorKey : null,
      actorName: String(x.actorName ?? ""),
      createdAt: tsIso(x.createdAt),
    };
  });
  return rows.reverse();
}

export async function createProposal(
  tripId: string,
  actor: { key: string; displayName: string },
  input: {
    kind: "destination" | "dates";
    label: string;
    iata: string | null;
    dateStart: string | null;
    dateEnd: string | null;
  }
): Promise<ProposalDto> {
  const id = nanoid();
  const ref = tripsCollection().doc(tripId).collection("proposals").doc(id);
  await ref.set({
    kind: input.kind,
    label: input.label.slice(0, 500),
    iata: input.iata,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd,
    createdByKey: actor.key,
    createdByName: actor.displayName.slice(0, 120),
    createdAt: FieldValue.serverTimestamp(),
  });
  return {
    id,
    kind: input.kind,
    label: input.label,
    iata: input.iata,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd,
    createdByKey: actor.key,
    createdByName: actor.displayName,
    createdAt: new Date().toISOString(),
    voteCount: 0,
    votedByMe: false,
  };
}

export async function listProposals(
  tripId: string,
  viewerKey: string | null
): Promise<ProposalDto[]> {
  const snap = await tripsCollection()
    .doc(tripId)
    .collection("proposals")
    .orderBy("createdAt", "desc")
    .limit(80)
    .get();

  const out: ProposalDto[] = [];
  for (const d of snap.docs) {
    const x = d.data();
    const votesSnap = await d.ref.collection("votes").get();
    const voteCount = votesSnap.size;
    const votedByMe = viewerKey
      ? votesSnap.docs.some((v) => v.id === viewerKey)
      : false;
    out.push({
      id: d.id,
      kind: x.kind === "dates" ? "dates" : "destination",
      label: String(x.label ?? ""),
      iata: typeof x.iata === "string" ? x.iata : null,
      dateStart: typeof x.dateStart === "string" ? x.dateStart : null,
      dateEnd: typeof x.dateEnd === "string" ? x.dateEnd : null,
      createdByKey: String(x.createdByKey ?? ""),
      createdByName: String(x.createdByName ?? ""),
      createdAt: tsIso(x.createdAt),
      voteCount,
      votedByMe,
    });
  }
  return out;
}

export async function toggleProposalVote(
  tripId: string,
  proposalId: string,
  actor: { key: string; displayName: string }
): Promise<{ voted: boolean }> {
  const voteRef = tripsCollection()
    .doc(tripId)
    .collection("proposals")
    .doc(proposalId)
    .collection("votes")
    .doc(actor.key);
  const snap = await voteRef.get();
  if (snap.exists) {
    await voteRef.delete();
    return { voted: false };
  }
  await voteRef.set({
    voterName: actor.displayName.slice(0, 120),
    createdAt: FieldValue.serverTimestamp(),
  });
  return { voted: true };
}

export function normalizeProposalIata(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  return normalizeIata(raw) ?? null;
}
