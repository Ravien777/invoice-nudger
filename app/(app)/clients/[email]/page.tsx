import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ClientDetailClient from "./ClientDetailClient";

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

  const { email } = await params;
  const clientEmail = decodeURIComponent(email);

  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId: user!.id, clientEmail } },
  });

  if (!profile) {
    notFound();
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: user!.id, clientEmail },
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
    <div>
      <a
        href="/clients"
        className="mb-4 inline-block text-sm text-accent hover:underline"
      >
        &larr; Back to all clients
      </a>
      <ClientDetailClient
        profile={serializedProfile}
        invoices={serializedInvoices}
      />
    </div>
  );
}
