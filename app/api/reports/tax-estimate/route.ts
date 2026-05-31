import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { getTaxYearRange, currentTaxYear } from "@/lib/tax-utils";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  const lookupEmail = accountantOwnerId
    ? (await prisma.user.findUnique({ where: { id: accountantOwnerId }, select: { email: true } }))?.email
    : session.user.email;

  const user = await prisma.user.findUnique({
    where: { email: lookupEmail ?? session.user.email },
    include: { businessProfile: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const bp = user.businessProfile ?? { taxRate: 0.25, fiscalYearStart: 1, baseCurrency: "USD" };

  const year = parseInt(req.nextUrl.searchParams.get("year") ?? String(currentTaxYear(bp.fiscalYearStart)), 10);
  const { start, end } = getTaxYearRange(bp.fiscalYearStart, year);

  const effectiveUserId = accountantOwnerId ?? user.id;

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.invoice.aggregate({
      where: {
        userId: effectiveUserId,
        status: "paid",
        paidAt: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: {
        userId: user.id,
        taxDeductible: true,
        date: { gte: start, lt: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const grossIncome = incomeAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const taxableIncome = Math.max(0, grossIncome - totalExpenses);
  const taxRate = bp.taxRate;
  const estimatedTax = taxableIncome * taxRate;

  const taxSavings = await prisma.businessProfile.findUnique({
    where: { userId: user.id },
    select: { taxSavingsAmount: true },
  });

  return NextResponse.json({
    year,
    grossIncome,
    totalExpenses,
    taxableIncome,
    estimatedTax,
    taxRate,
    taxSavingsAmount: taxSavings?.taxSavingsAmount ?? 0,
    currency: bp.baseCurrency,
  }, {
    headers: { "Cache-Control": "private, s-maxage=3600, stale-while-revalidate=600" },
  });
}
