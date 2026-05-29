import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import TimeClient from "./TimeClient";

export default async function TimePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });
  if (!user) redirect("/");

  const [entries, clients] = await Promise.all([
    prisma.timeEntry.findMany({
      where: { userId: user.id },
      orderBy: { startTime: "desc" },
      take: 200,
    }),
    prisma.timeEntry.findMany({
      where: { userId: user.id, invoiced: false },
      select: { clientEmail: true, clientName: true },
      distinct: ["clientEmail"],
      orderBy: { clientEmail: "asc" },
    }),
  ]);

  const serialized = entries.map((e) => ({
    ...e,
    startTime: e.startTime.toISOString(),
    endTime: e.endTime?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  const activeEntry = serialized.find((e) => !e.endTime) ?? null;

  return (
    <PageShell
      title="Time Tracking"
      subtitle="Track your hours. Bill your clients without the maths."
    >
      <TimeClient
        entries={serialized}
        activeEntry={activeEntry}
        defaultHourlyRate={user.businessProfile?.defaultHourlyRate ?? null}
        baseCurrency={user.businessProfile?.baseCurrency ?? "USD"}
      />
    </PageShell>
  );
}
