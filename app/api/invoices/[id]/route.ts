import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";
import { computePaymentProbabilityForInvoice } from "@/lib/analytics";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { getTeamContext } from "@/lib/team-session";

async function getInvoiceAndVerify(id: string, userId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return null;
  }

  if (invoice.userId !== userId) {
    return "unauthorized";
  }

  return invoice;
}

export async function GET(
  _request: Request,
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

  const { id } = await params;
  const teamCtx = await getTeamContext(session);
  const accountantOwnerId = teamCtx ? null : await getOwnerIdForAccountant(session.user.email);
  const effectiveUserId = teamCtx?.ownerId ?? accountantOwnerId ?? user.id;
  const result = await getInvoiceAndVerify(id, effectiveUserId);

  if (result === "unauthorized") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!result) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function PUT(
  request: Request,
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

  const { id } = await params;
  const teamCtx = await getTeamContext(session);
  if (teamCtx?.role === "viewer") {
    return NextResponse.json({ error: "Read-only access." }, { status: 403 });
  }
  const accountantOwnerId = teamCtx ? null : await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const effectiveUserId = teamCtx?.ownerId ?? user.id;
  const result = await getInvoiceAndVerify(id, effectiveUserId);

  if (result === "unauthorized") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!result) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
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

  let scheduleId: string | null = null;
  if (reminderScheduleId) {
    const schedule = await prisma.reminderSchedule.findFirst({
      where: { id: reminderScheduleId, userId: effectiveUserId },
    });
    if (schedule) {
      scheduleId = schedule.id;
    }
  }

  const promiseFields: Record<string, unknown> = {};
  if (body.promisedDate !== undefined) {
    promiseFields.promisedDate = body.promisedDate ? new Date(body.promisedDate) : null;
  }
  if (body.promiseStatus !== undefined) {
    promiseFields.promiseStatus = body.promiseStatus;
  }

  const lateFeeFields: Record<string, unknown> = {};
  if (body.lateFeeEnabled !== undefined) {
    lateFeeFields.lateFeeEnabled = body.lateFeeEnabled;
  }
  if (body.lateFeeAmount !== undefined) {
    lateFeeFields.lateFeeAmount = body.lateFeeAmount;
  }
  if (body.interestRate !== undefined) {
    lateFeeFields.interestRate = body.interestRate;
  }
  if (body.feeCap !== undefined) {
    lateFeeFields.feeCap = body.feeCap;
  }

  const updated = await prisma.invoice.update({
    where: { id },
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
      reminderScheduleId: scheduleId,
      ...promiseFields,
      ...lateFeeFields,
    },
  });

  computePaymentProbabilityForInvoice(id).catch(console.error);

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
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

  const { id } = await params;
  const teamCtx = await getTeamContext(session);
  if (teamCtx) {
    return NextResponse.json({ error: "Only the account owner can delete invoices." }, { status: 403 });
  }
  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const result = await getInvoiceAndVerify(id, user.id);

  if (result === "unauthorized") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!result) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  await prisma.reminderLog.deleteMany({ where: { invoiceId: id } });
  await prisma.invoice.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
