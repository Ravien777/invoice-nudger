import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PayClient from "./PayClient";

export default async function PayPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!invoice) {
    notFound();
  }

  return (
    <PayClient
      invoice={{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        clientEmail: invoice.clientEmail,
        amount: invoice.amount,
        currency: invoice.currency,
        dueDate: invoice.dueDate.toISOString(),
        status: invoice.status,
        notes: invoice.notes,
      }}
    />
  );
}
