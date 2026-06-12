import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InvoiceForm from "@/app/components/InvoiceForm";
import { PageShell } from "@/app/components/layout/PageShell";
import PaymentPlanSection from "../../components/PaymentPlanSection";

export const metadata: Metadata = { title: "Edit Invoice" };

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
    include: { businessProfile: true },
  });

  const bp = user?.businessProfile ?? { baseCurrency: "USD" };

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

  const hasPaymentMethod = !!(await prisma.clientPaymentMethod.findFirst({
    where: { userId: user.id, clientEmail: invoice.clientEmail, status: "active" },
  }));

  return (
    <PageShell
      title="Edit Invoice"
      subtitle="Update invoice details"
    >
      <InvoiceForm
        mode="edit"
        schedules={schedules}
        baseCurrency={bp.baseCurrency}
        initialData={{
          id: invoice.id,
          clientName: invoice.clientName,
          clientEmail: invoice.clientEmail,
          clientPhone: invoice.clientPhone,
          projectName: invoice.projectName,
          amount: invoice.amount,
          currency: invoice.currency,
          dueDate: invoice.dueDate.toISOString(),
          invoiceNumber: invoice.invoiceNumber,
          notes: invoice.notes,
          reminderScheduleId: invoice.reminderScheduleId,
          promisedDate: invoice.promisedDate?.toISOString() ?? null,
          promiseStatus: invoice.promiseStatus,
        }}
      />
      <div className="mt-6">
        <PaymentPlanSection invoiceId={invoice.id} hasPaymentMethod={hasPaymentMethod} />
      </div>
    </PageShell>
  );
}
