import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getTier } from "@/lib/tiers";

export const metadata: Metadata = { title: "Promises" };
import PromisesClient from "./PromisesClient";
import { PageShell } from "@/app/components/layout/PageShell";

export default async function PromisesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    redirect("/");
  }

  const tier = getTier(user.plan);
  if (tier.aiRemindersLimit === 0) {
    redirect("/dashboard");
  }

  const promises = await prisma.promiseEvent.findMany({
    where: { invoice: { userId: user.id } },
    take: 50,
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          clientEmail: true,
          amount: true,
          currency: true,
          dueDate: true,
          status: true,
        },
      },
    },
    orderBy: { detectedAt: "desc" },
  });

  const pendingCount = await prisma.promiseEvent.count({
    where: { invoice: { userId: user.id }, status: "pending_review" },
  });

  return (
    <PageShell title="Promise Detection" subtitle="Review payment promises detected in client replies">
      <PromisesClient initialPromises={promises} pendingCount={pendingCount} />
    </PageShell>
  );
}
