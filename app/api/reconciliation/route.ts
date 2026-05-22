import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileAll, reconcileInvoice } from "@/lib/reconciliation";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [reconciledCount, discrepancyCount, unreconciledCount, recentDiscrepancies] =
    await Promise.all([
      prisma.invoice.count({
        where: { userId: user.id, reconciliationStatus: "reconciled" },
      }),
      prisma.invoice.count({
        where: { userId: user.id, reconciliationStatus: "discrepancy" },
      }),
      prisma.invoice.count({
        where: {
          userId: user.id,
          OR: [{ reconciliationStatus: null }, { reconciliationStatus: undefined }],
          payments: { some: {} },
        },
      }),
      prisma.invoice.findMany({
        where: { userId: user.id, reconciliationStatus: "discrepancy" },
        include: { payments: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
    ]);

  return NextResponse.json({
    summary: {
      reconciled: reconciledCount,
      discrepancy: discrepancyCount,
      unreconciled: unreconciledCount,
    },
    discrepancies: recentDiscrepancies.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientName: inv.clientName,
      amount: inv.amount,
      currency: inv.currency,
      paymentCount: inv.payments.length,
      sources: [...new Set(inv.payments.map((p) => p.source))],
      updatedAt: inv.updatedAt,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("invoiceId");

  if (invoiceId) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice || invoice.userId !== user.id) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const result = await reconcileInvoice(invoiceId);
    return NextResponse.json({ result });
  }

  const results = await reconcileAll();

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
