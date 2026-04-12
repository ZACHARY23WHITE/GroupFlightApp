import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShareCode } from "@/lib/share-code";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name =
    typeof body === "object" &&
    body !== null &&
    "name" in body &&
    typeof (body as { name: unknown }).name === "string"
      ? (body as { name: string }).name.trim()
      : "";

  if (!name || name.length > 120) {
    return NextResponse.json(
      { error: "Trip name is required (max 120 characters)." },
      { status: 400 }
    );
  }

  for (let i = 0; i < 8; i++) {
    const shareCode = generateShareCode();
    try {
      const trip = await prisma.trip.create({
        data: { name, shareCode },
      });
      return NextResponse.json({ id: trip.id, shareCode: trip.shareCode });
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "Could not allocate a share code. Try again." },
    { status: 503 }
  );
}
