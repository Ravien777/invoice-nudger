import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PayrollClient from "./PayrollClient";

export const metadata: Metadata = { title: "Payroll" };

export default async function PayrollPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });

  if (!user) {
    redirect("/");
  }

  const contractors = await prisma.contractor.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { payments: true } },
    },
  });

  const payments = await prisma.contractorPayment.findMany({
    where: { userId: user.id },
    orderBy: { paymentDate: "desc" },
    include: { contractor: { select: { name: true } } },
  });

  const serializedPayments = payments.map((p) => ({
    ...p,
    paymentDate: p.paymentDate.toISOString(),
    createdAt: p.createdAt.toISOString(),
  }));

  return (
      <PayrollClient
        contractors={contractors}
        payments={serializedPayments}
        businessProfile={user.businessProfile}
        userPlan={user.plan}
        baseCurrency={user.businessProfile?.baseCurrency ?? "USD"}
      />
  );
}
