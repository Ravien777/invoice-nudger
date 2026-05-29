import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format-currency";
import { createPaymentRecord } from "@/lib/reconciliation";
import { createAllocationRecord } from "@/lib/allocation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ transactionId: string }> }
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

  const { transactionId } = await params;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id: transactionId, userId: user.id },
  });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }
  if (!tx.matchedInvoiceId) {
    return NextResponse.json({ error: "Transaction has no matched invoice" }, { status: 400 });
  }
  if (tx.status !== "matched") {
    return NextResponse.json({ error: "Transaction is not in matched status" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: tx.matchedInvoiceId },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Matched invoice not found" }, { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice is already paid" }, { status: 400 });
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: "paid", paidAt: new Date() },
  });

  await createPaymentRecord({
    invoiceId: invoice.id,
    source: "bank_import",
    amount: tx.amount,
    currency: tx.currency,
    paidAt: new Date(),
    notes: `Matched from bank transaction: ${tx.description}`,
  });

  await createAllocationRecord(user.id, tx.amount, tx.currency, invoice.id);

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "payment_received",
      title: "Payment matched from bank",
      message: `${formatCurrency(tx.amount, tx.currency)} matched for invoice ${invoice.clientName} from bank import.`,
      metadata: { invoiceId: invoice.id, transactionId: tx.id },
    },
  });

  return NextResponse.json({ success: true, invoiceId: invoice.id });
}
