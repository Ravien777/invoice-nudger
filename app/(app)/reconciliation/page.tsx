import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ReconciliationClient from "./ReconciliationClient";

export const metadata: Metadata = { title: "Reconciliation" };
import { PageShell } from "@/app/components/layout/PageShell";

export default async function ReconciliationPage() {
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

  const [reconciledCount, discrepancyCount, totalWithPayments] =
    await Promise.all([
      prisma.invoice.count({
        where: { userId: user.id, reconciliationStatus: "reconciled" },
      }),
      prisma.invoice.count({
        where: { userId: user.id, reconciliationStatus: "discrepancy" },
      }),
      prisma.invoice.count({
        where: { userId: user.id, payments: { some: {} } },
      }),
    ]);

  const discrepancyInvoices = await prisma.invoice.findMany({
    where: { userId: user.id, reconciliationStatus: "discrepancy" },
    include: { payments: { orderBy: { paidAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });

  const recentInvoices = await prisma.invoice.findMany({
    where: { userId: user.id, reconciliationStatus: "reconciled" },
    include: { payments: { orderBy: { paidAt: "desc" } } },
    orderBy: { lastReconciledAt: "desc" },
    take: 20,
  });

  return (
    <PageShell
      title="Payment Reconciliation"
      subtitle="Match payments to invoices and resolve discrepancies"
    >
      <ReconciliationClient
        summary={{
          reconciled: reconciledCount,
          discrepancy: discrepancyCount,
          totalWithPayments,
        }}
        discrepancies={discrepancyInvoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          amount: inv.amount,
          currency: inv.currency,
          payments: inv.payments.map((p) => ({
            id: p.id,
            source: p.source,
            amount: p.amount,
            currency: p.currency,
            paidAt: p.paidAt.toISOString(),
            referenceId: p.referenceId,
            status: p.status,
            notes: p.notes,
          })),
          updatedAt: inv.updatedAt.toISOString(),
        }))}
        recent={recentInvoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          amount: inv.amount,
          currency: inv.currency,
          payments: inv.payments.map((p) => ({
            id: p.id,
            source: p.source,
            amount: p.amount,
            currency: p.currency,
            paidAt: p.paidAt.toISOString(),
            referenceId: p.referenceId,
            status: p.status,
            notes: p.notes,
          })),
          lastReconciledAt: inv.lastReconciledAt?.toISOString() ?? null,
        }))}
      />
    </PageShell>
  );
}
