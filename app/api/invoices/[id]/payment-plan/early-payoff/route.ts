import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { earlyPayoff, handleEarlyPayoffSuccess } from "@/lib/payment-plan";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const plan = await prisma.paymentPlan.findUnique({
    where: { invoiceId: id },
    include: { invoice: true },
  });

  if (!plan || plan.invoice.userId !== user.id) {
    return NextResponse.json({ error: "Payment plan not found" }, { status: 404 });
  }

  try {
    const { paymentIntent } = await earlyPayoff(plan.id);

    if (paymentIntent.status === "succeeded") {
      await handleEarlyPayoffSuccess(paymentIntent);
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

    return NextResponse.json({ success: false, status: paymentIntent.status, error: paymentIntent.last_payment_error?.message });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Early payoff failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
