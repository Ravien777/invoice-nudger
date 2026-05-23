import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ClientDetailClient from "./ClientDetailClient";
import { PageShell } from "@/app/components/layout/PageShell";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
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

  const { email } = await params;
  const clientEmail = decodeURIComponent(email);

  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId: user.id, clientEmail } },
  });

  if (!profile) {
    notFound();
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id, clientEmail },
    orderBy: { dueDate: "desc" },
  });

  const serializedProfile = {
    ...profile,
    updatedAt: profile.updatedAt.toISOString(),
    createdAt: profile.createdAt.toISOString(),
    lastPaymentDate: profile.lastPaymentDate?.toISOString() ?? null,
  };

  const serializedInvoices = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    amount: inv.amount,
    currency: inv.currency,
    status: inv.status,
    dueDate: inv.dueDate.toISOString(),
    paidAt: inv.paidAt?.toISOString() ?? null,
  }));

  return (
    <PageShell title={clientEmail} subtitle="Client payment profile">
      <div className="mb-4">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all clients
        </Link>
      </div>
      <ClientDetailClient
        profile={serializedProfile}
        invoices={serializedInvoices}
      />
    </PageShell>
  );
}
