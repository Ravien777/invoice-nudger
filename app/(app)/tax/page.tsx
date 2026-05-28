import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import TaxClient from "./TaxClient";
import { currentTaxYear } from "@/lib/tax-utils";

export default async function TaxPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });
  if (!user) redirect("/");

  const bp = user.businessProfile ?? { taxRate: 0.25, fiscalYearStart: 1, taxSavingsAmount: 0, baseCurrency: "USD" };
  const year = currentTaxYear(bp.fiscalYearStart);

  return (
    <PageShell
      title="Tax Estimate"
      subtitle="A rough guide to what you might owe. Always check with your accountant."
    >
      <TaxClient
        initialYear={year}
        taxRate={bp.taxRate}
        fiscalYearStart={bp.fiscalYearStart}
        plan={user.plan}
        initialTaxSavings={bp.taxSavingsAmount}
        baseCurrency={bp.baseCurrency}
      />
    </PageShell>
  );
}
