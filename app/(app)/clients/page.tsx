import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ClientsClient from "./ClientsClient";

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
  });

  const serialized = profiles.map((p) => ({
    ...p,
    updatedAt: p.updatedAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    lastPaymentDate: p.lastPaymentDate?.toISOString() ?? null,
  }));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Client Payment Profiles</h1>
      <ClientsClient initialProfiles={serialized} />
    </div>
  );
}
