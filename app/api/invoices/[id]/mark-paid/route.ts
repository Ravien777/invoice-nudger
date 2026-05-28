import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentRecord } from "@/lib/reconciliation";
import { createAllocationRecord } from "@/lib/allocation";
import { computeClientProfilesForUser, recomputePaymentProbabilitiesForClient } from "@/lib/analytics";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "paid", paidAt: new Date() },
  });

  await createPaymentRecord({
    invoiceId: id,
    source: "manual",
    amount: invoice.amount,
    currency: invoice.currency,
    paidAt: new Date(),
    notes: "Manually marked as paid",
  });

  await createAllocationRecord(user.id, invoice.amount, invoice.currency, invoice.id);

  await prisma.reminderLog.create({
    data: {
      invoiceId: id,
      stepName: "manual_payment",
    },
  });

  await computeClientProfilesForUser(user.id);
  await recomputePaymentProbabilitiesForClient(user.id, invoice.clientEmail);

  return NextResponse.json(updated);
}
