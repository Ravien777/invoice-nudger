import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";
import { canCreateInvoice } from "@/lib/subscriptions";
import { computePaymentProbabilityForInvoice } from "@/lib/analytics";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { getTeamContext } from "@/lib/team-session";
import { dispatchWebhook } from "@/lib/webhook-dispatcher";
import { sendWebhook } from "@/lib/plazaos-webhook";

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

  const teamCtx = await getTeamContext(session);
  const accountantOwnerId = teamCtx ? null : await getOwnerIdForAccountant(session.user.email);
  const effectiveUserId = teamCtx?.ownerId ?? accountantOwnerId ?? user.id;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const limitParam = searchParams.get("limit");
  const take = Math.min(parseInt(limitParam || "200", 10), 1000);

  const where: Record<string, unknown> = { userId: effectiveUserId };
  if (statusFilter && statusFilter !== "all") {
    where.status = statusFilter;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      projectName: true,
      amount: true,
      currency: true,
      dueDate: true,
      status: true,
      notes: true,
      source: true,
      paymentLink: true,
      paidAt: true,
      reconciliationStatus: true,
      promiseStatus: true,
      promisedDate: true,
      promiseConfidence: true,
      lateFeeEnabled: true,
      lateFeeAmount: true,
      interestRate: true,
      accruedFees: true,
      feeCap: true,
      paymentProbability: true,
      instantPayoutId: true,
      paidOutAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(invoices, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
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

  const teamCtx = await getTeamContext(session);
  if (teamCtx?.role === "viewer") {
    return NextResponse.json({ error: "Read-only access." }, { status: 403 });
  }
  const accountantOwnerId = teamCtx ? null : await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const effectiveUserId = teamCtx?.ownerId ?? user.id;

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

  const limitCheck = await canCreateInvoice(effectiveUserId, 1);
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
      userId: effectiveUserId,
      reminderScheduleId: scheduleId,
      lateFeeEnabled: user.lateFeeEnabled,
      lateFeeAmount,
      interestRate: user.interestEnabled ? user.interestRate : 0,
      feeCap: user.feeCap,
    },
  });

  computePaymentProbabilityForInvoice(invoice.id).catch(console.error);

  dispatchWebhook(effectiveUserId, "invoice.created", {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientName: invoice.clientName,
    clientEmail: invoice.clientEmail,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate.toISOString(),
  }).catch(console.error);

  prisma.plazaosClient
    .findFirst({ where: { email: invoice.clientEmail } })
    .then((client) => {
      if (client) {
        sendWebhook("invoice.created", {
          client_id: client.id,
          invoice_id: invoice.id,
        });
      }
    })
    .catch(console.error);

  return NextResponse.json(invoice, { status: 201 });
}
