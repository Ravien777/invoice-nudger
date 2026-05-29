import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import RecurringClient, { type LineItemData } from "./RecurringClient";

export const dynamic = "force-dynamic";

export default async function RecurringPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });
  if (!user) redirect("/");

  const recurring = await prisma.recurringInvoice.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const schedules = await prisma.reminderSchedule.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  const serialized = recurring.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    clientEmail: r.clientEmail,
    amount: r.amount,
    currency: r.currency,
    frequency: r.frequency,
    dayOfMonth: r.dayOfMonth,
    nextRunDate: r.nextRunDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    description: r.description,
    lineItems: r.lineItems as unknown as LineItemData[] | null,
    status: r.status,
    autoSend: r.autoSend,
    reminderScheduleId: r.reminderScheduleId,
    invoicesCreated: r.invoicesCreated,
    lastRunDate: r.lastRunDate?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <PageShell
      title="Recurring Invoices"
      subtitle="Invoices that send themselves. Perfect for monthly retainers."
    >
      <RecurringClient initial={serialized} schedules={schedules} baseCurrency={user.businessProfile?.baseCurrency ?? "USD"} />
    </PageShell>
  );
}
