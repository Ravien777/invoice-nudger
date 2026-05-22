import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const pendingReminders = await prisma.reminderLog.findMany({
    where: {
      aiGenerated: true,
      approved: false,
      invoice: { userId: user.id },
    },
    include: {
      invoice: {
        select: {
          id: true,
          clientName: true,
          clientEmail: true,
          invoiceNumber: true,
          projectName: true,
          amount: true,
          currency: true,
          dueDate: true,
          status: true,
          paymentLink: true,
        },
      },
    },
    orderBy: { sentAt: "desc" },
  });

  const now = new Date();

  const queue = pendingReminders.map((log) => {
    const daysUntilDue = Math.ceil(
      (log.invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      id: log.id,
      invoiceId: log.invoice.id,
      clientName: log.invoice.clientName,
      invoiceNumber: log.invoice.invoiceNumber,
      projectName: log.invoice.projectName,
      amount: log.invoice.amount,
      currency: log.invoice.currency,
      dueDate: log.invoice.dueDate,
      status: log.invoice.status,
      stepName: log.stepName,
      subjectLine: log.subjectLine,
      emailBody: log.emailBody,
      generatedAt: log.sentAt,
      daysUntilDue,
      isExpired: daysUntilDue < 0 && log.invoice.status !== "paid",
    };
  });

  return NextResponse.json(queue);
}
