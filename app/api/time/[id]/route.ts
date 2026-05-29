import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getTeamContext } from "@/lib/team-session";

const updateSchema = z.object({
  clientEmail: z.string().email().optional(),
  clientName: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMinutes: z.number().int().positive().optional(),
  hourlyRate: z.number().positive().optional(),
});

export async function GET(
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
  const effectiveUserId = teamCtx?.ownerId ?? user.id;

  const { id } = await params;
  const entry = await prisma.timeEntry.findFirst({
    where: { id, userId: effectiveUserId },
  });
  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function PUT(
  req: NextRequest,
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
  const existing = await prisma.timeEntry.findFirst({
    where: { id, userId: effectiveUserId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.invoiced) {
    return NextResponse.json({ error: "Cannot edit an invoiced time entry" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.startTime) data.startTime = new Date(data.startTime as string);
  if (data.endTime) data.endTime = new Date(data.endTime as string);

  const entry = await prisma.timeEntry.update({
    where: { id },
    data,
  });

  return NextResponse.json({ entry });
}

export async function DELETE(
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
  if (teamCtx) {
    return NextResponse.json({ error: "Only the account owner can delete time entries." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.timeEntry.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.invoiced) {
    return NextResponse.json({ error: "Cannot delete an invoiced time entry" }, { status: 400 });
  }

  await prisma.timeEntry.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
