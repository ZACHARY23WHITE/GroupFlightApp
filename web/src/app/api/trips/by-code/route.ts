import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (!raw) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const trip = await prisma.trip.findUnique({
    where: { shareCode: raw },
    select: { id: true },
  });

  if (!trip) {
    return NextResponse.json({ error: "No trip with that code." }, { status: 404 });
  }

  return NextResponse.json({ id: trip.id });
}
