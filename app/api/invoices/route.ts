import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invoiceSchema } from "@/lib/validations";

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

  const invoice = await prisma.invoice.create({
    data: {
      clientName,
      clientEmail,
      amount,
      currency: currency || "USD",
      dueDate: new Date(dueDate),
      invoiceNumber: invoiceNumber || null,
      notes: notes || null,
      userId: user.id,
      reminderScheduleId: scheduleId,
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
