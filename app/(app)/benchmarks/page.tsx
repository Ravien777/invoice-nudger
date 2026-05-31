import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import nextDynamic from "next/dynamic";
import { PageShell } from "@/app/components/layout/PageShell";

const BenchmarksClient = nextDynamic(() => import("./BenchmarksClient"), {
  loading: () => (
    <div className="h-80 rounded-xl bg-surface-muted animate-pulse" />
  ),
});

export default async function BenchmarksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    redirect("/");
  }

  const industry = user.industry;
  const rawBenchmarks = industry
    ? await prisma.industryBenchmark.findMany({
        where: { industry },
        orderBy: { computedAt: "desc" },
        take: 40,
      })
    : [];

  const rawAllBenchmarks = await prisma.industryBenchmark.findMany({
    where: { industry: "all" },
    orderBy: { computedAt: "desc" },
    take: 40,
  });

  const benchmarks = rawBenchmarks.map((b) => ({ ...b, computedAt: b.computedAt.toISOString() }));
  const allBenchmarks = rawAllBenchmarks.map((b) => ({ ...b, computedAt: b.computedAt.toISOString() }));

  return (
    <PageShell title="Benchmarks" subtitle="Compare your payment metrics against industry peers">
      <BenchmarksClient
        industry={industry}
        benchmarks={benchmarks}
        allBenchmarks={allBenchmarks}
      />
    </PageShell>
  );
}
