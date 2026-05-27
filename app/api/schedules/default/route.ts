import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

export async function GET() {
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  const effectiveUserId = accountantOwnerId ?? user.id;

  const schedule = await prisma.reminderSchedule.findFirst({
    where: { userId: effectiveUserId, isDefault: true },
    include: { steps: { orderBy: { daysOffset: "asc" } } },
  });

  return NextResponse.json(schedule);
}

export async function PUT(request: Request) {
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const schedule = await prisma.reminderSchedule.findFirst({
    where: { userId: user.id, isDefault: true },
  });

  if (!schedule) {
    return NextResponse.json({ error: "No default schedule found" }, { status: 404 });
  }

  const body = await request.json();
  const { name, steps } = body;

  if (!Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json(
      { error: "At least one step is required" },
      { status: 400 }
    );
  }

  for (const step of steps) {
    if (typeof step.daysOffset !== "number") {
      return NextResponse.json(
        { error: "Each step must have a numeric daysOffset" },
        { status: 400 }
      );
    }
    if (!step.emailTemplate || typeof step.emailTemplate !== "string") {
      return NextResponse.json(
        { error: "Each step must have an emailTemplate" },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.reminderSchedule.update({
    where: { id: schedule.id },
    data: {
      name: name || schedule.name,
      steps: {
        deleteMany: {},
        create: steps.map((s: { daysOffset: number; emailTemplate: string }) => ({
          daysOffset: s.daysOffset,
          emailTemplate: s.emailTemplate,
        })),
      },
    },
    include: { steps: { orderBy: { daysOffset: "asc" } } },
  });

  return NextResponse.json(updated);
}
