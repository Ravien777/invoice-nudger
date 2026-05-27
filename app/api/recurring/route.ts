import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recurringSchema } from "@/lib/validations";
import { computeNextRunDate } from "@/lib/date-utils";
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

  const recurring = await prisma.recurringInvoice.findMany({
    where: { userId: effectiveUserId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(recurring);
}

export async function POST(request: Request) {
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

  const recurring = await prisma.recurringInvoice.create({
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
      userId: user.id,
    },
  });

  return NextResponse.json(recurring, { status: 201 });
}
