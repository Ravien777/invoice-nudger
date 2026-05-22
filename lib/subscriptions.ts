import { prisma } from "./prisma";
import { startOfMonth, endOfMonth } from "date-fns";
import { TIERS, getTier, type TierConfig } from "./tiers";

export { TIERS, getTier, type TierConfig };

export async function getMonthlyInvoiceCount(userId: string): Promise<number> {
  const monthStart = startOfMonth(new Date());
  const monthEnd = endOfMonth(new Date());

  return prisma.invoice.count({
    where: {
      userId,
      createdAt: { gte: monthStart, lte: monthEnd },
    },
  });
}

export async function canCreateInvoice(userId: string, count: number = 1): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = getTier(user?.plan ?? "free");

  if (tier.invoiceLimit === null) {
    return { allowed: true, current: 0, limit: null, tier: user?.plan ?? "free" };
  }

  const current = await getMonthlyInvoiceCount(userId);

  return {
    allowed: current + count <= tier.invoiceLimit,
    current,
    limit: tier.invoiceLimit,
    tier: user?.plan ?? "free",
  };
}

export async function getAIMonthlyUsage(userId: string): Promise<number> {
  const now = new Date();
  const usage = await prisma.aIReminderUsage.findUnique({
    where: {
      userId_month_year: {
        userId,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    select: { count: true },
  });

  return usage?.count ?? 0;
}

export async function canGenerateAI(userId: string): Promise<{ allowed: boolean; used: number; limit: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = getTier(user?.plan ?? "free");

  if (tier.aiRemindersLimit === 0) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const used = await getAIMonthlyUsage(userId);

  return {
    allowed: used < tier.aiRemindersLimit,
    used,
    limit: tier.aiRemindersLimit,
  };
}

export async function incrementAIUsage(userId: string): Promise<number> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const updated = await prisma.aIReminderUsage.upsert({
    where: {
      userId_month_year: {
        userId,
        month,
        year,
      },
    },
    create: {
      userId,
      month,
      year,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
    select: { count: true },
  });

  return updated.count;
}

export async function canUseClientPortal(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = getTier(user?.plan ?? "free");
  return tier.clientPortal;
}

export async function getMonthlyNotificationUsage(userId: string, channel: string): Promise<number> {
  const now = new Date();
  const usage = await prisma.notificationUsage.findUnique({
    where: {
      userId_channel_month_year: {
        userId,
        channel,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    select: { count: true },
  });

  return usage?.count ?? 0;
}

export async function canSendNotification(userId: string, channel: "sms" | "whatsapp"): Promise<{ allowed: boolean; used: number; limit: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = getTier(user?.plan ?? "free");
  const limit = channel === "sms" ? tier.smsLimit : tier.whatsappLimit;

  if (limit === 0) {
    return { allowed: false, used: 0, limit: 0 };
  }

  const used = await getMonthlyNotificationUsage(userId, channel);

  return {
    allowed: used < limit,
    used,
    limit,
  };
}

export async function incrementNotificationUsage(userId: string, channel: "sms" | "whatsapp"): Promise<number> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const updated = await prisma.notificationUsage.upsert({
    where: {
      userId_channel_month_year: {
        userId,
        channel,
        month,
        year,
      },
    },
    create: {
      userId,
      channel,
      month,
      year,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
    select: { count: true },
  });

  return updated.count;
}
