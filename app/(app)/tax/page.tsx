import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import TaxClient from "./TaxClient";

function currentTaxYear(fiscalYearStart: number) {
  const now = new Date();
  const startMonth = fiscalYearStart - 1;
  return now.getMonth() >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
}

export default async function TaxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true, taxRate: true, fiscalYearStart: true, taxSavingsAmount: true, baseCurrency: true },
  });
  if (!user) redirect("/");

  const year = currentTaxYear(user.fiscalYearStart);

  return (
    <PageShell
      title="Tax Estimate"
      subtitle="A rough guide to what you might owe. Always check with your accountant."
    >
      <TaxClient
        initialYear={year}
        taxRate={user.taxRate}
        fiscalYearStart={user.fiscalYearStart}
        plan={user.plan}
        initialTaxSavings={user.taxSavingsAmount}
        baseCurrency={user.baseCurrency}
      />
    </PageShell>
  );
}
