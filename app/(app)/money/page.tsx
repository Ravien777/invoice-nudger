import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { startOfYear } from "date-fns";

export const metadata: Metadata = { title: "My Money" };
import { PageShell } from "@/app/components/layout/PageShell";
import MoneyClient from "./MoneyClient";

export const dynamic = "force-dynamic";

export default async function MoneyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const [profile, records, totals] = await Promise.all([
    prisma.allocationProfile.findUnique({
      where: { userId: user.id },
    }),
    prisma.allocationRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.allocationRecord.aggregate({
      where: {
        userId: user.id,
        createdAt: { gte: startOfYear(new Date()) },
      },
      _sum: {
        totalReceived: true,
        taxAmount: true,
        operatingAmount: true,
        profitAmount: true,
        ownerPayAmount: true,
      },
    }),
  ]);

  const invoiceIds = records.map((r) => r.invoiceId).filter(Boolean) as string[];
  const invoices = invoiceIds.length > 0
    ? await prisma.invoice.findMany({
        where: { id: { in: invoiceIds } },
        select: { id: true, clientName: true, invoiceNumber: true },
      })
    : [];
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));

  const serializedRecords = records.map((r) => {
    const inv = r.invoiceId ? invoiceMap.get(r.invoiceId) : null;
    return {
      id: r.id,
      totalReceived: r.totalReceived,
      taxAmount: r.taxAmount,
      operatingAmount: r.operatingAmount,
      profitAmount: r.profitAmount,
      ownerPayAmount: r.ownerPayAmount,
      currency: r.currency,
      invoiceId: r.invoiceId,
      clientName: inv?.clientName ?? null,
      invoiceNumber: inv?.invoiceNumber ?? null,
      note: r.note,
      createdAt: r.createdAt.toISOString(),
    };
  });

  const initialTotals = {
    totalReceived: totals._sum.totalReceived ?? 0,
    taxAmount: totals._sum.taxAmount ?? 0,
    operatingAmount: totals._sum.operatingAmount ?? 0,
    profitAmount: totals._sum.profitAmount ?? 0,
    ownerPayAmount: totals._sum.ownerPayAmount ?? 0,
  };

  return (
    <PageShell
      title="My Money"
      subtitle="Allocate every dollar you earn — tax, business, profit, and your pay."
    >
      <MoneyClient
        initialProfile={profile ?? null}
        initialRecords={serializedRecords}
        initialTotals={initialTotals}
      />
    </PageShell>
  );
}
