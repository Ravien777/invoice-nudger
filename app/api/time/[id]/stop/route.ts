import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTeamContext } from "@/lib/team-session";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const teamCtx = await getTeamContext(session);
  if (teamCtx?.role === "viewer") {
    return NextResponse.json({ error: "Read-only access." }, { status: 403 });
  }

  const effectiveUserId = teamCtx?.ownerId ?? user.id;

  const { id } = await params;
  const entry = await prisma.timeEntry.findFirst({
    where: { id, userId: effectiveUserId },
  });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (entry.endTime) {
    return NextResponse.json({ error: "Timer is already stopped" }, { status: 400 });
  }

  const endTime = new Date();
  const durationMinutes = Math.round((endTime.getTime() - entry.startTime.getTime()) / 60000);

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { endTime, durationMinutes },
  });

  return NextResponse.json({ entry: updated });
}
