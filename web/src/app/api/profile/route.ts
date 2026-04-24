import { NextResponse } from "next/server";
import {
  getUserProfile,
  upsertUserProfile,
  type ProfileWriteInput,
} from "@/lib/firestore-profiles";
import { CABIN_OPTIONS } from "@/lib/travel-class";
import { verifyBearerUid } from "@/lib/verify-bearer";

const CABIN_VALUES = new Set<string>(CABIN_OPTIONS.map((o) => o.value));

function profileIdFromLegacyHeader(req: Request): string | null {
  const header = req.headers.get("x-profile-id")?.trim();
  if (header && /^[a-zA-Z0-9_-]{8,128}$/.test(header)) return header;
  return null;
}

async function resolveProfileId(req: Request): Promise<
  | { ok: true; profileId: string; source: "firebase" | "legacy" }
  | { ok: false; error: string; status: number }
> {
  const uid = await verifyBearerUid(req);
  if (uid) {
    return { ok: true, profileId: uid, source: "firebase" };
  }
  const legacy = profileIdFromLegacyHeader(req);
  if (legacy) {
    return { ok: true, profileId: legacy, source: "legacy" };
  }
  return {
    ok: false,
    error:
      "Sign in, or pass a valid X-Profile-Id header for guest profiles on this device.",
    status: 401,
  };
}

function parseBool(v: unknown, def: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return def;
}

function parsePartyInt(
  body: Record<string, unknown>,
  key: string,
  def: number,
  min: number,
  max: number
): number {
  const v = body[key];
  if (v === undefined || v === null) return def;
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number.parseInt(v, 10)
        : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export async function GET(req: Request) {
  const resolved = await resolveProfileId(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }
  const profile = await getUserProfile(resolved.profileId);
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const resolved = await resolveProfileId(req);
  if (!resolved.ok) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

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
  const displayName =
    typeof b.displayName === "string" ? b.displayName : "";
  const email = typeof b.email === "string" ? b.email : "";
  const phone = typeof b.phone === "string" ? b.phone : "";
  const homeAirport =
    typeof b.homeAirport === "string" ? b.homeAirport : "";
  const homeCity = typeof b.homeCity === "string" ? b.homeCity : "";

  const familyAdults = parsePartyInt(b, "familyAdults", 1, 1, 9);
  const familyChildren = parsePartyInt(b, "familyChildren", 0, 0, 8);

  const cabinRaw = b.preferredCabin;
  const preferredCabin =
    typeof cabinRaw === "string" && CABIN_VALUES.has(cabinRaw)
      ? cabinRaw
      : "economy";

  let profilePhotoDataUrl: string | null = null;
  if (b.profilePhotoDataUrl === null) {
    profilePhotoDataUrl = null;
  } else if (typeof b.profilePhotoDataUrl === "string") {
    profilePhotoDataUrl = b.profilePhotoDataUrl;
  }

  const input: ProfileWriteInput = {
    displayName,
    email,
    phone,
    homeAirport,
    familyAdults,
    familyChildren,
    preferredCabin,
    profilePhotoDataUrl,
    smsUpdatesOptIn: parseBool(b.smsUpdatesOptIn, false),
    homeCity,
    markOnboardingComplete: parseBool(b.markOnboardingComplete, false),
  };

  try {
    const profile = await upsertUserProfile(resolved.profileId, input);
    return NextResponse.json({ profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save profile.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
