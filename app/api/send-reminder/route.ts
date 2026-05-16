import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendReminderEmail } from "@/lib/email";

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

  const { invoiceId, stepName } = await request.json();

  if (!invoiceId || !stepName) {
    return NextResponse.json(
      { error: "invoiceId and stepName are required" },
      { status: 400 }
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  const schedule = await prisma.reminderSchedule.findFirst({
    where: {
      id: invoice.reminderScheduleId ?? undefined,
      userId: user.id,
    },
    include: { steps: true },
  });

  const defaultSchedule = await prisma.reminderSchedule.findFirst({
    where: { userId: user.id, isDefault: true },
    include: { steps: true },
  });

  const effectiveSchedule = schedule ?? defaultSchedule;

  if (!effectiveSchedule) {
    return NextResponse.json(
      { error: "No reminder schedule found for this user" },
      { status: 404 }
    );
  }

  const step = effectiveSchedule.steps.find((s) => s.emailTemplate === stepName);

  if (!step) {
    return NextResponse.json(
      { error: `Step "${stepName}" not found in schedule` },
      { status: 404 }
    );
  }

  const result = await sendReminderEmail(
    {
      id: invoice.id,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      invoiceNumber: invoice.invoiceNumber,
    },
    step
  );

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, stepName });
}
