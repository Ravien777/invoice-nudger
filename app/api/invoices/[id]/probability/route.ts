import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";

export async function GET(
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

  const tier = getTier(user.plan);
  const hasAccess = tier.features.includes("payment_probability");

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      paymentProbability: true,
      clientEmail: true,
      dueDate: true,
      status: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!hasAccess) {
    return NextResponse.json(
      {
        score: null,
        factors: null,
        label: "Upgrade to Pro to see payment probability scores.",
        upgradeRequired: true,
      },
      { status: 402 }
    );
  }

  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId: user.id, clientEmail: invoice.clientEmail } },
  });

  const factors: Record<string, unknown> = {};
  let label = "";

  if (!profile || profile.paidInvoices === 0) {
    factors.confidence = "low";
    label = "Not enough payment history for this client. Estimated at 70%.";
  } else {
    const onTimeRatio = profile.onTimePayments / profile.paidInvoices;
    factors.onTimeRatio = onTimeRatio;
    factors.avgDaysLate = profile.avgDaysLate;
    factors.confidence = "medium";
    const onTimePct = (onTimeRatio * 100).toFixed(0);
    const daysLate = profile.avgDaysLate?.toFixed(1) ?? "0";
    label = `Based on this client's history of paying ${onTimePct}% on time and averaging ${daysLate} days late.`;
  }

  return NextResponse.json({
    score: invoice.paymentProbability,
    factors,
    label,
  });
}
