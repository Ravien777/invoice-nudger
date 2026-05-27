import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/app/components/layout/PageShell";
import { Button } from "@/app/components/ui/Button";
import { FileText, Receipt, Calculator, BarChart3, ArrowLeft } from "lucide-react";

export default async function AccountantViewPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/");
  }

  const { ownerId } = await params;

  const access = await prisma.accountantAccess.findFirst({
    where: {
      ownerId,
      accountantEmail: session.user.email,
      status: "active",
    },
    include: {
      owner: { select: { name: true, email: true } },
    },
  });

  if (!access) {
    redirect("/dashboard");
  }

  const ownerName = access.owner.name || access.owner.email || "this account";

  return (
    <PageShell
      title={`${ownerName}'s Account`}
      subtitle="You are viewing this account in read-only mode."
      actions={
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" icon={ArrowLeft}>
            Return to your account
          </Button>
        </Link>
      }
    >
      {/* Read-only banner */}
      <div className="mb-6 rounded-xl border border-[var(--warning-muted)] bg-[var(--warning-muted)]/30 p-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-[var(--warning)]" />
          <p className="text-sm text-[var(--warning)]">
            You&apos;re viewing <strong>{ownerName}</strong>&apos;s account in read-only mode. Edit actions are disabled.
          </p>
        </div>
      </div>

      {/* Quick links */}
      <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Access</h2>
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href={`/invoices`}
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md hover:border-accent/30"
        >
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Invoice History</p>
            <p className="text-xs text-muted">View all invoices</p>
          </div>
        </Link>

        <Link
          href={`/expenses`}
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md hover:border-accent/30"
        >
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Expense Report</p>
            <p className="text-xs text-muted">View all expenses</p>
          </div>
        </Link>

        <Link
          href={`/tax`}
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md hover:border-accent/30"
        >
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <Calculator className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Tax Estimate</p>
            <p className="text-xs text-muted">Tax breakdown & P&L</p>
          </div>
        </Link>

        <Link
          href={`/benchmarks`}
          className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:shadow-md hover:border-accent/30"
        >
          <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
            <BarChart3 className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Benchmarks</p>
            <p className="text-xs text-muted">Compare against peers</p>
          </div>
        </Link>
      </div>

    </PageShell>
  );
}
