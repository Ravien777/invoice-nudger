import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/layout/PageShell";
import ContractsClient from "./ContractsClient";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) redirect("/");

  const contracts = await prisma.contract.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      clientName: true,
      clientEmail: true,
      status: true,
      signedAt: true,
      sentAt: true,
      createdAt: true,
      pdfUrl: true,
      signingToken: true,
    },
  });

  const templates = await prisma.contractTemplate.findMany({
    where: { userId: null },
    select: { id: true, name: true, body: true },
  });

  const serialized = contracts.map((c) => ({
    ...c,
    signedAt: c.signedAt?.toISOString() ?? null,
    sentAt: c.sentAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  const serializedTemplates = templates.map((t) => ({
    id: t.id,
    name: t.name,
    body: t.body,
  }));

  return (
    <PageShell
      title="Contracts"
      subtitle="Protect yourself before work starts. Send a contract, get it signed in minutes."
    >
      <ContractsClient
        contracts={serialized}
        templates={serializedTemplates}
      />
    </PageShell>
  );
}
