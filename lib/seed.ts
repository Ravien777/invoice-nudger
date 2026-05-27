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

interface SampleInvoiceInput {
  clientName: string;
  clientEmail: string;
  amount: number;
  projectName: string;
  status: "unpaid" | "paid" | "overdue";
  dueDate: Date;
  paidAt?: Date;
}

const SAMPLE_INVOICES: SampleInvoiceInput[] = [
  { clientName: "Acme Corp", clientEmail: "billing@acme.com", amount: 2500, projectName: "Web development project", status: "paid", dueDate: new Date("2026-05-01"), paidAt: new Date("2026-05-03") },
  { clientName: "Smith Design", clientEmail: "hello@smithdesign.com", amount: 850, projectName: "Brand identity package", status: "paid", dueDate: new Date("2026-04-20"), paidAt: new Date("2026-04-25") },
  { clientName: "Greenfield LLC", clientEmail: "accounts@greenfield.io", amount: 4200, projectName: "Q3 consulting retainer", status: "overdue", dueDate: new Date("2026-05-01") },
  { clientName: "Pixel Studio", clientEmail: "info@pixelstudio.co", amount: 1200, projectName: "Mobile app UI design", status: "unpaid", dueDate: new Date("2026-07-10") },
  { clientName: "Coastal Marketing", clientEmail: "jane@coastalmarketing.com", amount: 1800, projectName: "SEO audit + recommendations", status: "paid", dueDate: new Date("2026-05-15"), paidAt: new Date("2026-05-14") },
  { clientName: "Beacon Agency", clientEmail: "billing@beaconagency.com", amount: 3400, projectName: "Social media campaign", status: "unpaid", dueDate: new Date("2026-07-20") },
  { clientName: "Riverbend Consulting", clientEmail: "hello@riverbend.co", amount: 950, projectName: "Business strategy session", status: "paid", dueDate: new Date("2026-05-10"), paidAt: new Date("2026-05-08") },
  { clientName: "Northwind Traders", clientEmail: "accounts@northwind.com", amount: 6800, projectName: "Supply chain audit", status: "overdue", dueDate: new Date("2026-04-01") },
  { clientName: "Sterling & Co.", clientEmail: "info@sterlingco.com", amount: 2100, projectName: "Annual brand refresh", status: "unpaid", dueDate: new Date("2026-06-30") },
  { clientName: "Horizon Ventures", clientEmail: "jane@horizon.ventures", amount: 5500, projectName: "Market research report", status: "paid", dueDate: new Date("2026-05-20"), paidAt: new Date("2026-05-22") },
  { clientName: "Maple Leaf Services", clientEmail: "contact@mapleleaf.io", amount: 1600, projectName: "IT infrastructure assessment", status: "unpaid", dueDate: new Date("2026-07-25") },
  { clientName: "Blue Ridge Partners", clientEmail: "team@blueridgepartners.com", amount: 3900, projectName: "Q4 advisory retainer", status: "overdue", dueDate: new Date("2026-05-25") },
  { clientName: "Crestview Media", clientEmail: "hello@crestview.media", amount: 750, projectName: "Content strategy workshop", status: "unpaid", dueDate: new Date("2026-08-01") },
  { clientName: "Pacific Northwest Ltd", clientEmail: "billing@pacificnw.com", amount: 4800, projectName: "Product launch campaign", status: "unpaid", dueDate: new Date("2026-09-15") },
  { clientName: "Apex Digital", clientEmail: "info@apexdigital.com", amount: 2950, projectName: "Website redesign", status: "unpaid", dueDate: new Date("2026-06-10") },
];

export async function seedSampleInvoices(userId: string) {
  const count = await prisma.invoice.count({ where: { userId } });
  if (count > 0) return;

  await prisma.invoice.createMany({
    data: SAMPLE_INVOICES.map((inv) => ({
      userId,
      clientName: inv.clientName,
      clientEmail: inv.clientEmail,
      amount: inv.amount,
      projectName: inv.projectName,
      status: inv.status,
      dueDate: inv.dueDate,
      paidAt: inv.paidAt ?? null,
      currency: "USD",
    })),
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
