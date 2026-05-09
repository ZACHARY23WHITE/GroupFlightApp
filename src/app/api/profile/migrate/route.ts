import { NextResponse } from "next/server";
import { migrateLegacyProfileToUid } from "@/lib/firestore-profiles";
import { verifyBearerUid } from "@/lib/verify-bearer";

export async function POST(req: Request) {
  const uid = await verifyBearerUid(req);
  if (!uid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  const legacy = (body as { legacyProfileId?: string }).legacyProfileId?.trim();
  if (!legacy || !/^[a-zA-Z0-9_-]{8,128}$/.test(legacy)) {
    return NextResponse.json(
      { error: "Invalid legacyProfileId." },
      { status: 400 }
    );
  }
  if (legacy === uid) {
    return NextResponse.json({ error: "Invalid legacy id." }, { status: 400 });
  }

  try {
    const profile = await migrateLegacyProfileToUid(legacy, uid);
    if (!profile) {
      return NextResponse.json(
        { error: "No profile found for that device id." },
        { status: 404 }
      );
    }
    return NextResponse.json({ profile });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Migration failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
