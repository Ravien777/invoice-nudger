import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InvoiceForm from "@/app/components/InvoiceForm";

export default async function EditInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice || !user || invoice.userId !== user.id) {
    notFound();
  }

  const schedules = await prisma.reminderSchedule.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        Edit Invoice
      </h1>
      <InvoiceForm
        mode="edit"
        schedules={schedules}
        initialData={{
          id: invoice.id,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate.toISOString(),
          invoiceNumber: invoice.invoiceNumber,
          notes: invoice.notes,
          reminderScheduleId: invoice.reminderScheduleId,
        }}
      />
    </div>
  );
}
