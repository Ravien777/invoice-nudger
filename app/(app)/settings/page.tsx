import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import { getMonthlyInvoiceCount, getTier, getAIMonthlyUsage, canUseClientPortal, getMonthlyNotificationUsage, canAddTeamMembers } from "@/lib/subscriptions";
import { assignReceiptEmail } from "@/lib/assign-receipt-emails";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });
  if (!user) redirect("/");

  let receiptEmail = user!.receiptEmail;
  if (!receiptEmail) {
    receiptEmail = await assignReceiptEmail(user!.id);
  }

  const schedule = await prisma.reminderSchedule.findFirst({
    where: { userId: user!.id, isDefault: true },
    include: { steps: { orderBy: { daysOffset: "asc" } } },
  });

  const integrations = await prisma.integrationConnection.findMany({
    where: { userId: user!.id },
    orderBy: { platform: "asc" },
  });

  const monthlyInvoiceCount = await getMonthlyInvoiceCount(user!.id);
  const tier = getTier(user!.plan);
  const aiUsage = await getAIMonthlyUsage(user!.id);
  const portalEnabled = user!.portalEnabled;
  const portalBranding = user!.portalBranding ? JSON.parse(user!.portalBranding) : {};
  const hasPortalAccess = await canUseClientPortal(user!.id);
  const smsUsage = await getMonthlyNotificationUsage(user!.id, "sms");
  const whatsappUsage = await getMonthlyNotificationUsage(user!.id, "whatsapp");

  const promiseStats = {
    active: await prisma.promiseEvent.count({
      where: { invoice: { userId: user!.id }, status: "active" },
    }),
    pending: await prisma.promiseEvent.count({
      where: { invoice: { userId: user!.id }, status: "pending_review" },
    }),
    expired: await prisma.promiseEvent.count({
      where: { invoice: { userId: user!.id }, status: "expired" },
    }),
  };

  const accountantAccess = await prisma.accountantAccess.findMany({
    where: { ownerId: user!.id },
    orderBy: { invitedAt: "desc" },
  });

  const teamMembers = await prisma.teamMember.findMany({
    where: { ownerId: user!.id },
    orderBy: { invitedAt: "desc" },
  });

  const hasTeamAccess = await canAddTeamMembers(user!.id);

  const parsedAlertPrefs = user!.alertPreferences
    ? JSON.parse(JSON.stringify(user!.alertPreferences))
    : {};

  return (
    <SettingsClient
      schedule={schedule}
      integrations={integrations}
      accountantAccess={accountantAccess.map((a) => ({
        id: a.id,
        accountantEmail: a.accountantEmail,
        status: a.status,
        invitedAt: a.invitedAt.toISOString(),
        acceptedAt: a.acceptedAt?.toISOString() ?? null,
        revokedAt: a.revokedAt?.toISOString() ?? null,
      }))}
      billing={{
        plan: user!.plan,
        subscriptionStatus: user!.subscriptionStatus,
        tier,
        monthlyInvoiceCount,
      }}
      aiSettings={{
        enabled: user!.aiRemindersEnabled,
        tone: user!.aiTone,
        usage: aiUsage,
        limit: tier.aiRemindersLimit,
      }}
      portalSettings={{
        enabled: portalEnabled,
        branding: {
          businessName: portalBranding.businessName || user!.name || "",
          logoUrl: portalBranding.logoUrl || "",
          accentColor: portalBranding.accentColor || "#2563eb",
          tagline: portalBranding.tagline || "",
          faviconUrl: portalBranding.faviconUrl || "",
        },
        hasAccess: hasPortalAccess,
      }}
      promiseSettings={{
        active: promiseStats.active,
        pending: promiseStats.pending,
        expired: promiseStats.expired,
        hasAccess: tier.aiRemindersLimit > 0,
      }}
      notificationSettings={{
        sms: { enabled: tier.smsLimit > 0, limit: tier.smsLimit, used: smsUsage },
        whatsapp: { enabled: tier.whatsappLimit > 0, limit: tier.whatsappLimit, used: whatsappUsage },
      }}
      teamSettings={{
        members: teamMembers.map((tm) => ({
          id: tm.id,
          memberEmail: tm.memberEmail,
          role: tm.role,
          status: tm.status,
          invitedAt: tm.invitedAt.toISOString(),
          acceptedAt: tm.acceptedAt?.toISOString() ?? null,
          removedAt: tm.removedAt?.toISOString() ?? null,
        })),
        hasAccess: hasTeamAccess,
        tier,
      }}
      lateFeeSettings={{
        enabled: user!.lateFeeEnabled,
        type: user!.lateFeeType,
        value: user!.lateFeeValue,
        frequency: user!.lateFeeFrequency,
        interestEnabled: user!.interestEnabled,
        interestRate: user!.interestRate,
        graceDays: user!.lateFeeGraceDays,
        feeCap: user!.feeCap,
        hasAccess: tier.lateFees,
      }}
      industrySettings={{
        industry: user!.industry,
        benchmarksOptOut: user!.benchmarksOptOut,
      }}
      userProfile={{
        name: user!.name,
        email: user!.email,
        alertPreferences: parsedAlertPrefs,
        taxRate: user!.businessProfile?.taxRate ?? 0.25,
        fiscalYearStart: user!.businessProfile?.fiscalYearStart ?? 1,
        taxSavingsAmount: user!.businessProfile?.taxSavingsAmount ?? 0,
        baseCurrency: user!.businessProfile?.baseCurrency ?? "USD",
        defaultHourlyRate: user!.businessProfile?.defaultHourlyRate ?? 0,
        receiptEmail,
      }}
    />
  );
}
