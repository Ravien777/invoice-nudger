import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientsClient from "./ClientsClient";
import { PageShell } from "@/app/components/layout/PageShell";

export default async function ClientsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const profiles = await prisma.clientPaymentProfile.findMany({
    where: { userId: user!.id },
    orderBy: { riskScore: "desc" },
    take: 100,
  });

  const serialized = profiles.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    lastPaymentDate: p.lastPaymentDate?.toISOString() ?? null,
  }));

  return (
    <PageShell
      title="Clients"
      subtitle="View and manage client payment profiles"
    >
      <ClientsClient initialProfiles={serialized} />
    </PageShell>
  );
}
