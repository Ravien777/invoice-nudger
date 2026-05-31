import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import InvoicesClient from "./InvoicesClient";

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const invoices = await prisma.invoice.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const defaultSchedule = await prisma.reminderSchedule.findFirst({
    where: { userId: user!.id, isDefault: true },
    include: { steps: { orderBy: { daysOffset: "asc" } } },
  });

  const clientProfiles = await prisma.clientPaymentProfile.findMany({
    where: { userId: user!.id },
    select: { clientEmail: true, riskScore: true },
  });

  const riskScores: Record<string, number> = {};
  for (const cp of clientProfiles) {
    if (cp.riskScore !== null) {
      riskScores[cp.clientEmail] = cp.riskScore;
    }
  }

  const probabilities: Record<string, number> = {};
  for (const inv of invoices) {
    if (inv.paymentProbability !== null) {
      probabilities[inv.id] = inv.paymentProbability;
    }
  }

  const serialized = invoices.map((inv) => ({
    ...inv,
    dueDate: inv.dueDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    paidAt: inv.paidAt?.toISOString() ?? null,
    paidOutAt: inv.paidOutAt?.toISOString() ?? null,
    promisedDate: inv.promisedDate?.toISOString() ?? null,
  }));

  const scheduleSteps = defaultSchedule?.steps.map((s) => ({
    emailTemplate: s.emailTemplate,
    daysOffset: s.daysOffset,
  })) ?? [];

  return <InvoicesClient initialInvoices={serialized} scheduleSteps={scheduleSteps} userTone={user?.aiTone} riskScores={riskScores} probabilities={probabilities} userPlan={user?.plan ?? "free"} />;
}
