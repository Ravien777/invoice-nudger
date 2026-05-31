import { prisma } from "@/lib/prisma";
import { subDays, differenceInCalendarDays } from "date-fns";
import BenchmarkWidget from "./BenchmarkWidget";

export default async function BenchmarkSection({
  userId, industry,
}: {
  userId: string; industry: string | null;
}) {
  let benchmarkData: Array<{
    userValue: number; industryValue: number; metric: string;
    label: string; higherIsBetter: boolean; format: "days" | "percentage";
  }> = [];
  let hasEnoughBenchmarks = false;

  const userPaidInvoices = await prisma.invoice.findMany({
    where: { userId, status: "paid", paidAt: { not: null } },
    select: { dueDate: true, paidAt: true, amount: true },
    take: 1000,
  });

  const userDaysToPay = userPaidInvoices
    .map((inv) => differenceInCalendarDays(inv.paidAt!, inv.dueDate))
    .filter((d) => d !== null);
  const userAvgDaysToPay = userDaysToPay.length > 0
    ? userDaysToPay.reduce((a, b) => a + b, 0) / userDaysToPay.length
    : 0;
  const userLatePct = userDaysToPay.length > 0
    ? (userDaysToPay.filter((d) => d > 0).length / userDaysToPay.length) * 100
    : 0;

  const [userOldInvoices, userOldPaid] = await Promise.all([
    prisma.invoice.count({
      where: { userId, createdAt: { lte: subDays(new Date(), 90) } },
    }),
    prisma.invoice.count({
      where: { userId, status: "paid", createdAt: { lte: subDays(new Date(), 90) } },
    }),
  ]);
  const userCollectionRate = userOldInvoices > 0 ? (userOldPaid / userOldInvoices) * 100 : 0;

  if (industry) {
    const benchmarks = await prisma.industryBenchmark.findMany({
      where: { industry },
      orderBy: { computedAt: "desc" },
      take: 4,
    });

    if (benchmarks.length >= 4) {
      hasEnoughBenchmarks = true;
      const bm = new Map(benchmarks.map((b) => [b.metric, b]));
      benchmarkData = [
        {
          metric: "avg_days_to_pay",
          label: "Avg Days to Pay",
          userValue: userAvgDaysToPay,
          industryValue: bm.get("avg_days_to_pay")?.value ?? 0,
          higherIsBetter: false,
          format: "days",
        },
        {
          metric: "collection_rate",
          label: "Collection Rate (90d)",
          userValue: userCollectionRate,
          industryValue: bm.get("collection_rate")?.value ?? 0,
          higherIsBetter: true,
          format: "percentage",
        },
        {
          metric: "late_payment_percentage",
          label: "Late Payment %",
          userValue: userLatePct,
          industryValue: bm.get("late_payment_percentage")?.value ?? 0,
          higherIsBetter: false,
          format: "percentage",
        },
      ];
    }
  }

  return (
    <div className="mb-8">
      <BenchmarkWidget
        benchmarks={benchmarkData}
        industry={industry}
        hasEnoughData={hasEnoughBenchmarks}
      />
    </div>
  );
}
