import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InvoiceForm from "@/app/components/InvoiceForm";
import { PageShell } from "@/app/components/layout/PageShell";

export default async function NewInvoicePage() {
  const session = await getServerSession(authOptions);

  const user = await prisma.user.findUnique({
    where: { email: session!.user!.email! },
  });

  const schedules = await prisma.reminderSchedule.findMany({
    where: { userId: user!.id },
    select: { id: true, name: true, isDefault: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <PageShell
      title="New Invoice"
      subtitle="Create a new invoice for your client"
    >
      <InvoiceForm mode="create" schedules={schedules} />
    </PageShell>
  );
}
