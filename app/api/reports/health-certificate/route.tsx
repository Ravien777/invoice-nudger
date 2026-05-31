import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateBusinessHealthScore } from "@/lib/health-score";
import { formatCurrency } from "@/lib/format-currency";

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

  if (user.plan !== "agency") {
    return NextResponse.json(
      { error: "Upgrade to Agency to download the Health Certificate." },
      { status: 403 },
    );
  }

  const health = await calculateBusinessHealthScore(user.id);
  const businessName = user.name ?? "Your Business";

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [paidInvoices, totalInvoicedYearResult] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId: user.id, status: "paid", paidAt: { not: null } },
      select: { paidAt: true, dueDate: true, amount: true },
    }),
    prisma.invoice.aggregate({
      where: { userId: user.id, createdAt: { gte: yearStart } },
      _sum: { amount: true },
    }),
  ]);

  const totalInvoicedYear = totalInvoicedYearResult._sum.amount ?? 0;
  const paidCount = paidInvoices.length;
  const onTimeCount = paidInvoices.filter(
    (inv) => inv.paidAt! <= inv.dueDate,
  ).length;

  const collectionRatePct =
    paidCount > 0 ? `${((onTimeCount / paidCount) * 100).toFixed(0)}%` : "N/A";

  const collectionRateOverall = health.breakdown.collectionRate;
  const match = collectionRateOverall.details.match(/(\d+)%/);
  const overallCollectionRate = match ? `${match[1]}%` : "N/A";

  const avgDaysDetails = health.breakdown.avgDaysToPay.details;
  const daysMatch = avgDaysDetails.match(/[\d.]+/);
  const avgPaymentTime = daysMatch ? `${daysMatch[0]} days` : "N/A";

  const onTimePct =
    paidCount > 0 ? `${((onTimeCount / paidCount) * 100).toFixed(0)}%` : "N/A";

  const baseCurrency = (user as any).businessProfile?.baseCurrency ?? "USD";

  const breakdown = [
    {
      label: "Collection Rate",
      score: health.breakdown.collectionRate.score,
      maxScore: health.breakdown.collectionRate.maxScore,
      color: "#22c55e",
    },
    {
      label: "Payment Speed",
      score: health.breakdown.avgDaysToPay.score,
      maxScore: health.breakdown.avgDaysToPay.maxScore,
      color: "#3b82f6",
    },
    {
      label: "Revenue Stability",
      score: health.breakdown.revenueConsistency.score,
      maxScore: health.breakdown.revenueConsistency.maxScore,
      color: "#8b5cf6",
    },
    {
      label: "Expense Control",
      score: health.breakdown.expenseRatio.score,
      maxScore: health.breakdown.expenseRatio.maxScore,
      color: "#f59e0b",
    },
    {
      label: "Tax Readiness",
      score: health.breakdown.taxReserve.score,
      maxScore: health.breakdown.taxReserve.maxScore,
      color: "#06b6d4",
    },
  ];

  const { renderToBuffer } = await import("@react-pdf/renderer");
  const { HealthCertificateDocument } = await import("./HealthCertificatePDF");

  const buffer = await renderToBuffer(
    <HealthCertificateDocument
      score={health.score}
      breakdown={breakdown}
      businessName={businessName}
      dateStr={dateStr}
      totalInvoicedYear={formatCurrency(totalInvoicedYear, baseCurrency)}
      collectionRatePct={overallCollectionRate}
      avgPaymentTime={avgPaymentTime}
      onTimePct={onTimePct}
      currency={baseCurrency}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="health-certificate-${now.toISOString().split("T")[0]}.pdf"`,
    },
  });
}
