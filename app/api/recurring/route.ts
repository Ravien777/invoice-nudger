import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recurringSchema } from "@/lib/validations";
import { computeNextRunDate } from "@/lib/date-utils";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

export async function GET(request: Request) {
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

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const recurring = await prisma.recurringInvoice.findMany({
    where: { userId: effectiveUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      amount: true,
      currency: true,
      frequency: true,
      dayOfMonth: true,
      nextRunDate: true,
      endDate: true,
      description: true,
      lineItems: true,
      status: true,
      autoSend: true,
      reminderScheduleId: true,
      invoicesCreated: true,
      lastRunDate: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(recurring, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
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

  const { clientName, clientEmail, clientPhone, amount, currency, frequency, dayOfMonth, nextRunDate, endDate, description, autoSend, reminderScheduleId, lineItems } = validation.data;

  const parsedNextRun = new Date(nextRunDate);
  let finalNextRun = parsedNextRun;

  if ((frequency === "monthly" || frequency === "quarterly") && dayOfMonth) {
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
      reminderScheduleId: reminderScheduleId || null,
      lineItems: lineItems && lineItems.length > 0 ? lineItems : undefined,
      userId: user.id,
    },
  });

  return NextResponse.json(recurring, { status: 201 });
}
