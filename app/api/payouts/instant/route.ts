import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { createAllocationRecord } from "@/lib/allocation";

export async function POST(request: Request) {
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

  if (user.plan === "free") {
    return NextResponse.json({ error: "Upgrade to Pro to use Instant Payouts." }, { status: 403 });
  }

  const body = await request.json();
  const { invoiceId } = body;

  if (!invoiceId || typeof invoiceId !== "string") {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.status !== "paid") {
    return NextResponse.json({ error: "Invoice must be paid before requesting a payout." }, { status: 400 });
  }

  if (invoice.instantPayoutId) {
    return NextResponse.json({ error: "An instant payout has already been requested for this invoice." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const payout = await stripe.payouts.create({
      amount: Math.round(invoice.amount * 100),
      currency: invoice.currency.toLowerCase(),
      method: "instant",
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { instantPayoutId: payout.id, paidOutAt: new Date() },
    });

    const balanceTxns = await stripe.balanceTransactions.list({
      payout: payout.id,
      limit: 1,
    });
    const fee = balanceTxns.data[0]?.fee ? Math.abs(balanceTxns.data[0].fee) / 100 : 0;

    await createAllocationRecord(
      user.id,
      invoice.amount,
      invoice.currency,
      invoice.id,
      invoice.clientName,
    );

    return NextResponse.json({
      payoutId: payout.id,
      amount: payout.amount / 100,
      fee,
      arrivalTime: payout.arrival_date,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
