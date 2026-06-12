import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getMonthlyInvoiceCount, getTier } from "@/lib/subscriptions";
import BillingClient from "./BillingClient";
import { PageShell } from "@/app/components/layout/PageShell";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/");
  }

  const monthlyCount = await getMonthlyInvoiceCount(user.id);
  const tier = getTier(user.plan);

  return (
    <PageShell title="Billing" subtitle="Manage your subscription and plan">
      <BillingClient
        user={{
          id: user.id,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
          stripePriceId: user.stripePriceId,
        }}
        tier={tier}
        monthlyInvoiceCount={monthlyCount}
      />
    </PageShell>
  );
}
