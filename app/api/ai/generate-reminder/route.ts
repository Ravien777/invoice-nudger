import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReminderCopy, type Tone } from "@/lib/openai";
import { canGenerateAI, incrementAIUsage } from "@/lib/subscriptions";

const VALID_TONES: Tone[] = ["professional", "friendly", "firm", "casual"];

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
  const { invoiceId, tone, stepName } = body;

  if (!invoiceId || !stepName) {
    return NextResponse.json(
      { error: "invoiceId and stepName are required" },
      { status: 400 }
    );
  }

  const selectedTone: Tone = VALID_TONES.includes(tone) ? tone : user.aiTone as Tone;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, userId: user.id },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return NextResponse.json(
      { error: "Cannot generate AI reminder for paid or cancelled invoices" },
      { status: 400 }
    );
  }

  const limitCheck = await canGenerateAI(user.id);
  if (!limitCheck.allowed) {
    return NextResponse.json(
      {
        error: `AI reminder limit reached. You've used ${limitCheck.used}/${limitCheck.limit} this month. Upgrade your plan for more.`,
        used: limitCheck.used,
        limit: limitCheck.limit,
      },
      { status: 429 }
    );
  }

  const existingAI = await prisma.reminderLog.findFirst({
    where: {
      invoiceId: invoice.id,
      stepName,
      aiGenerated: true,
      approved: false,
    },
  });

  if (existingAI) {
    return NextResponse.json(
      { error: "AI reminder already generated for this step. Approve or reject it first." },
      { status: 409 }
    );
  }

  const schedule =
    invoice.reminderScheduleId
      ? await prisma.reminderSchedule.findUnique({
          where: { id: invoice.reminderScheduleId },
          include: { steps: true },
        })
      : await prisma.reminderSchedule.findFirst({
          where: { userId: user.id, isDefault: true },
          include: { steps: true },
        });

  const step = schedule?.steps.find((s) => s.emailTemplate === stepName);
  const daysOffset = step?.daysOffset ?? 0;

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

  try {
    const generated = await generateReminderCopy({
      clientName: invoice.clientName,
      projectName: invoice.projectName,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      daysOffset,
      tone: selectedTone,
      paymentLink,
    });

    const newCount = await incrementAIUsage(user.id);

    const reminderLog = await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        stepName,
        emailBody: generated.html,
        subjectLine: generated.subject,
        aiGenerated: true,
        approved: false,
      },
    });

    return NextResponse.json({
      subject: generated.subject,
      html: generated.html,
      reminderLogId: reminderLog.id,
      usageRemaining: limitCheck.limit - newCount,
    });
  } catch (err) {
    console.error("AI generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate AI reminder. Please try again." },
      { status: 500 }
    );
  }
}
