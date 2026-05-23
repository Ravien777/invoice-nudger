import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";
import { canCreateInvoice } from "@/lib/subscriptions";
import { computePaymentProbabilityForInvoice } from "@/lib/analytics";

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

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");

  const where: Record<string, unknown> = { userId: user.id };
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invoices);
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

  const body = await request.json();
  const validation = invoiceSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { clientName, clientEmail, clientPhone, projectName, amount, currency, dueDate, invoiceNumber, notes, reminderScheduleId } =
    validation.data;

  const limitCheck = await canCreateInvoice(user.id, 1);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      { error: `Invoice limit reached. You've created ${limitCheck.current}/${limitCheck.limit} invoices this month. Upgrade your plan to create more.` },
      { status: 402 }
    );
  }

  let scheduleId: string | null = null;
  if (reminderScheduleId) {
    const schedule = await prisma.reminderSchedule.findFirst({
      where: { id: reminderScheduleId, userId: user.id },
    });
    if (schedule) {
      scheduleId = schedule.id;
    }
  }

  const lateFeeAmount =
    user.lateFeeType === "fixed"
      ? user.lateFeeValue
      : (user.lateFeeValue / 100) * amount;

  const invoice = await prisma.invoice.create({
    data: {
      clientName,
      clientEmail,
      clientPhone: clientPhone || null,
      projectName: projectName || null,
      amount,
      currency: currency || "USD",
      dueDate: new Date(dueDate),
      invoiceNumber: invoiceNumber || null,
      notes: notes || null,
      userId: user.id,
      reminderScheduleId: scheduleId,
      lateFeeEnabled: user.lateFeeEnabled,
      lateFeeAmount,
      interestRate: user.interestEnabled ? user.interestRate : 0,
      feeCap: user.feeCap,
    },
  });

  await computePaymentProbabilityForInvoice(invoice.id);

  return NextResponse.json(invoice, { status: 201 });
}
