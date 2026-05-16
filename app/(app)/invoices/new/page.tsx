import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import InvoiceForm from "@/app/components/InvoiceForm";

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
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">
        New Invoice
      </h1>
      <InvoiceForm mode="create" schedules={schedules} />
    </div>
  );
}
