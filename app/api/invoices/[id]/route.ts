import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";

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
  const result = await getInvoiceAndVerify(id, user.id);

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
  const result = await getInvoiceAndVerify(id, user.id);

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

  const { clientName, clientEmail, amount, currency, dueDate, invoiceNumber, notes, reminderScheduleId } =
    validation.data;

  let scheduleId: string | null = null;
  if (reminderScheduleId) {
    const schedule = await prisma.reminderSchedule.findFirst({
      where: { id: reminderScheduleId, userId: user.id },
    });
    if (schedule) {
      scheduleId = schedule.id;
    }
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      clientName,
      clientEmail,
      amount,
      currency: currency || "USD",
      dueDate: new Date(dueDate),
      invoiceNumber: invoiceNumber || null,
      notes: notes || null,
      reminderScheduleId: scheduleId,
    },
  });

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
