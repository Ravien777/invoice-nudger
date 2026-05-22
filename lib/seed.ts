import { prisma } from "./prisma";
import { startOfDay, endOfDay, differenceInCalendarDays, subDays } from "date-fns";

const DEFAULT_SCHEDULE_STEPS = [
  { daysOffset: -3, emailTemplate: "gentle_reminder" },
  { daysOffset: 0, emailTemplate: "due_today" },
  { daysOffset: 3, emailTemplate: "overdue_notice" },
  { daysOffset: 7, emailTemplate: "firm_reminder" },
  { daysOffset: 14, emailTemplate: "final_notice" },
];

export async function seedDefaultSchedule(userId: string) {
  const existing = await prisma.reminderSchedule.findFirst({
    where: { userId, isDefault: true },
  });

  if (existing) return existing;

  return prisma.reminderSchedule.create({
    data: {
      name: "Standard",
      isDefault: true,
      userId,
      steps: {
        create: DEFAULT_SCHEDULE_STEPS,
      },
    },
    include: { steps: true },
  });
}

export async function seedHistoricalAnalytics() {
  const users = await prisma.user.findMany({ select: { id: true } });

  for (const user of users) {
    const invoices = await prisma.invoice.findMany({
      where: { userId: user.id },
      select: {
        status: true,
        amount: true,
        dueDate: true,
        paidAt: true,
        clientEmail: true,
        createdAt: true,
      },
    });

    if (invoices.length === 0) continue;

    const dateMap = new Map<string, {
      totalInvoices: number;
      paidInvoices: number;
      overdueInvoices: number;
      totalAmount: number;
      collectedAmount: number;
      overdueAmount: number;
      daysToPay: number[];
      activeEmails: Set<string>;
    }>();

    for (const inv of invoices) {
      const dueDay = startOfDay(inv.dueDate);
      const dueKey = dueDay.toISOString();

      const entry = dateMap.get(dueKey) || {
        totalInvoices: 0,
        paidInvoices: 0,
        overdueInvoices: 0,
        totalAmount: 0,
        collectedAmount: 0,
        overdueAmount: 0,
        daysToPay: [],
        activeEmails: new Set<string>(),
      };

      entry.totalInvoices++;
      entry.totalAmount += inv.amount;
      entry.activeEmails.add(inv.clientEmail);

      if (inv.status === "paid" && inv.paidAt) {
        const paidDay = startOfDay(inv.paidAt);
        const paidKey = paidDay.toISOString();
        const paidEntry = dateMap.get(paidKey) || {
          totalInvoices: 0,
          paidInvoices: 0,
          overdueInvoices: 0,
          totalAmount: 0,
          collectedAmount: 0,
          overdueAmount: 0,
          daysToPay: [],
          activeEmails: new Set<string>(),
        };
        paidEntry.paidInvoices++;
        paidEntry.collectedAmount += inv.amount;
        paidEntry.activeEmails.add(inv.clientEmail);
        paidEntry.daysToPay.push(differenceInCalendarDays(inv.paidAt, inv.dueDate));
        dateMap.set(paidKey, paidEntry);
      }

      if (inv.status === "overdue" || (inv.status === "unpaid" && inv.dueDate <= new Date())) {
        entry.overdueInvoices++;
        entry.overdueAmount += inv.amount;
      }

      dateMap.set(dueKey, entry);
    }

    for (const [dateStr, data] of dateMap) {
      const date = new Date(dateStr);
      const avgDaysToPay = data.daysToPay.length > 0
        ? data.daysToPay.reduce((a, b) => a + b, 0) / data.daysToPay.length
        : null;

      await prisma.invoiceDailySummary.upsert({
        where: { userId_date: { userId: user.id, date } },
        create: {
          userId: user.id,
          date,
          totalInvoices: data.totalInvoices,
          paidInvoices: data.paidInvoices,
          overdueInvoices: data.overdueInvoices,
          totalAmount: data.totalAmount,
          collectedAmount: data.collectedAmount,
          overdueAmount: data.overdueAmount,
          avgDaysToPay,
          activeClientEmails: JSON.stringify([...data.activeEmails]),
        },
        update: {
          totalInvoices: data.totalInvoices,
          paidInvoices: data.paidInvoices,
          overdueInvoices: data.overdueInvoices,
          totalAmount: data.totalAmount,
          collectedAmount: data.collectedAmount,
          overdueAmount: data.overdueAmount,
          avgDaysToPay,
          activeClientEmails: JSON.stringify([...data.activeEmails]),
        },
      });
    }

    const grouped = new Map<string, {
      totalInvoices: number;
      paidInvoices: number;
      onTimePayments: number;
      totalAmount: number;
      lateDays: number[];
      lastPaymentDate: Date | null;
    }>();

    for (const inv of invoices) {
      const group = grouped.get(inv.clientEmail) || {
        totalInvoices: 0,
        paidInvoices: 0,
        onTimePayments: 0,
        totalAmount: 0,
        lateDays: [] as number[],
        lastPaymentDate: null as Date | null,
      };
      group.totalInvoices++;
      group.totalAmount += inv.amount;

      if (inv.status === "paid") {
        group.paidInvoices++;
        if (inv.paidAt) {
          if (!group.lastPaymentDate || inv.paidAt > group.lastPaymentDate) {
            group.lastPaymentDate = inv.paidAt;
          }
          const daysLate = differenceInCalendarDays(inv.paidAt, inv.dueDate);
          if (daysLate <= 0) {
            group.onTimePayments++;
          } else {
            group.lateDays.push(daysLate);
          }
        } else {
          group.onTimePayments++;
        }
      }

      grouped.set(inv.clientEmail, group);
    }

    for (const [clientEmail, data] of grouped) {
      const avgDaysLate = data.lateDays.length > 0
        ? data.lateDays.reduce((a, b) => a + b, 0) / data.lateDays.length
        : null;

      const onTimeRatio = data.paidInvoices > 0
        ? data.onTimePayments / data.paidInvoices
        : 0;

      const riskScore = Math.min(
        Math.max((1 - onTimeRatio) * 0.7 + (avgDaysLate !== null ? Math.min(avgDaysLate, 30) / 30 : 0) * 0.3, 0),
        1
      );

      await prisma.clientPaymentProfile.upsert({
        where: { userId_clientEmail: { userId: user.id, clientEmail } },
        create: {
          userId: user.id,
          clientEmail,
          totalInvoices: data.totalInvoices,
          paidInvoices: data.paidInvoices,
          onTimePayments: data.onTimePayments,
          totalAmount: data.totalAmount,
          avgDaysLate,
          lastPaymentDate: data.lastPaymentDate,
          riskScore,
        },
        update: {
          totalInvoices: data.totalInvoices,
          paidInvoices: data.paidInvoices,
          onTimePayments: data.onTimePayments,
          totalAmount: data.totalAmount,
          avgDaysLate,
          lastPaymentDate: data.lastPaymentDate,
          riskScore,
        },
      });
    }
  }

  return { seeded: true };
}
