import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";

export const metadata: Metadata = { title: "Forecast" };
import { PageShell } from "@/app/components/layout/PageShell";
import { getTier } from "@/lib/tiers";

const ForecastClient = nextDynamic(() => import("./ForecastClient"), {
  loading: () => (
    <div className="h-80 rounded-xl bg-surface-muted animate-pulse" />
  ),
});

export default async function ForecastPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true },
  });

  if (!user) {
    redirect("/");
  }

  const tier = getTier(user.plan);
  const hasAccess = tier.features.includes("cash_flow_forecast");

  if (!hasAccess) {
    return (
      <PageShell
        title="Cash Flow Forecast"
        subtitle="Project your cash position over the next 90 days"
      >
        <div className="max-w-2xl mx-auto mt-16 text-center">
          <div className="bg-surface-secondary rounded-xl border border-border-default p-12">
            <div className="text-6xl mb-4 text-text-tertiary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mx-auto text-text-tertiary"
              >
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Cash Flow Forecast
            </h2>
            <p className="text-text-secondary mb-6 max-w-md mx-auto">
              See what&apos;s coming in over the next 90 days — expected income
              from open invoices and recurring billing, projected expenses, and
              your cumulative cash position.
            </p>
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-accent">Pro feature.</span>{" "}
                Upgrade to unlock your personalized cash flow forecast with
                confidence indicators and weekly breakdowns.
              </p>
            </div>
            <a
              href="/settings/billing"
              className="inline-flex items-center justify-center rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-dark transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Cash Flow Forecast"
      subtitle="Project your cash position over the next 90 days"
    >
      <ForecastClient />
    </PageShell>
  );
}
