import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { PageShell } from "@/app/components/layout/PageShell";

export const metadata: Metadata = { title: "Business Health" };
import { calculateBusinessHealthScore } from "@/lib/health-score";
import { calculateAllClientHealthScores } from "@/lib/client-health";
import HealthClient from "./HealthClient";

export default async function HealthPage() {
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

  if (user.plan === "free") {
    return (
      <PageShell
        title="Business Health"
        subtitle="A quick check-up for your business finances"
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
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Your Business Health Score
            </h2>
            <p className="text-text-secondary mb-6 max-w-md mx-auto">
              Track how healthy your business is financially — collection rates,
              payment speed, expense control, and tax readiness. See which clients
              are reliable and which need attention.
            </p>
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-text-secondary">
                <span className="font-medium text-accent">Pro feature.</span>{" "}
                Upgrade to unlock your personalized business health score and
                per-client risk analysis.
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

  const [healthResult, clientScores] = await Promise.all([
    calculateBusinessHealthScore(user.id),
    calculateAllClientHealthScores(user.id),
  ]);

  const score = healthResult.score;
  const clientScoresSerialized = clientScores.map((c) => ({
    ...c,
    signals: c.signals,
  }));

  return (
    <PageShell
      title="Business Health"
      subtitle="A quick check-up for your business finances"
      actions={
        user.plan === "agency" ? (
          <a
            href="/api/reports/health-certificate"
            className="inline-flex items-center gap-2 rounded-lg border border-border-default px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-surface-tertiary transition-colors"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline">Download Health Certificate</span>
          </a>
        ) : null
      }
    >
      <HealthClient
        score={score}
        breakdown={healthResult.breakdown}
        tips={healthResult.tips}
        clientScores={clientScoresSerialized}
      />
    </PageShell>
  );
}
