import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDefaultPaymentMethod, chargeClient, handleChargeSuccess, handleChargeFailure, canAutoCharge } from "@/lib/auto-charge";

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

  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  const usage = await canAutoCharge(user.id);
  if (!usage.allowed) {
    return NextResponse.json(
      { error: "Monthly auto-charge limit reached", used: usage.used, limit: usage.limit },
      { status: 403 },
    );
  }

  const cpm = await getDefaultPaymentMethod(user.id, invoice.clientEmail);
  if (!cpm) {
    return NextResponse.json({ error: "No saved payment method for this client" }, { status: 400 });
  }

  try {
    const paymentIntent = await chargeClient(
      cpm.id,
      invoice.amount,
      invoice.currency,
      invoice.id,
      `Invoice ${invoice.invoiceNumber ?? invoice.id} - ${invoice.clientName}`,
    );

    if (paymentIntent.status === "succeeded") {
      await handleChargeSuccess(paymentIntent);
      return NextResponse.json({ success: true, status: "succeeded", paymentIntentId: paymentIntent.id });
    }

    if (paymentIntent.status === "requires_action") {
      return NextResponse.json({
        success: true,
        status: "requires_action",
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
      });
    }

    await handleChargeFailure(paymentIntent);
    return NextResponse.json({ success: false, status: paymentIntent.status, error: paymentIntent.last_payment_error?.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Charge failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
