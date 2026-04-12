import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string; travelerId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { id: tripId, travelerId } = await ctx.params;

  const existing = await prisma.traveler.findFirst({
    where: { id: travelerId, tripId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Traveler not found" }, { status: 404 });
  }

  await prisma.traveler.delete({ where: { id: travelerId } });
  return NextResponse.json({ ok: true });
}
