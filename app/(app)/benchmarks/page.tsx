import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import BenchmarksClient from "./BenchmarksClient";

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
    <div>
      <h1 className="mb-6 text-2xl font-bold">Benchmark Trends</h1>
      <BenchmarksClient
        industry={industry}
        benchmarks={benchmarks}
        allBenchmarks={allBenchmarks}
      />
    </div>
  );
}
