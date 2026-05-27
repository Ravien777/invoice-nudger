import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recurringSchema } from "@/lib/validations";
import { computeNextRunDate } from "@/lib/date-utils";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  return user?.id ?? null;
}

async function getEffectiveUserId(sessionEmail: string): Promise<{ userId: string; accountantOwnerId: string | null }> {
  const user = await prisma.user.findUnique({ where: { email: sessionEmail } });
  if (!user) return { userId: "", accountantOwnerId: null };
  const accountantOwnerId = await getOwnerIdForAccountant(sessionEmail);
  return { userId: user.id, accountantOwnerId };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, accountantOwnerId } = await getEffectiveUserId(session.user.email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const effectiveUserId = accountantOwnerId ?? userId;

  const { id } = await params;
  const recurring = await prisma.recurringInvoice.findFirst({
    where: { id, userId: effectiveUserId },
  });
  if (!recurring) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(recurring);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, accountantOwnerId } = await getEffectiveUserId(session.user.email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.recurringInvoice.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const validation = recurringSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten() },
      { status: 400 },
    );
  }

  const { clientName, clientEmail, clientPhone, amount, currency, frequency, dayOfMonth, nextRunDate, endDate, description, autoSend } = validation.data;

  const parsedNextRun = new Date(nextRunDate);
  let finalNextRun = parsedNextRun;

  if (frequency === "monthly" && dayOfMonth) {
    finalNextRun = computeNextRunDate(frequency, dayOfMonth, parsedNextRun);
  }

  const updated = await prisma.recurringInvoice.update({
    where: { id },
    data: {
      clientName,
      clientEmail,
      clientPhone: clientPhone || null,
      amount,
      currency: currency || "USD",
      frequency,
      dayOfMonth: dayOfMonth || null,
      nextRunDate: finalNextRun,
      endDate: endDate ? new Date(endDate) : null,
      description: description || null,
      autoSend,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, accountantOwnerId } = await getEffectiveUserId(session.user.email);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.recurringInvoice.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.recurringInvoice.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
