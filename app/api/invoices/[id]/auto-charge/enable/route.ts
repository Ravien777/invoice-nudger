import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAutoCharge } from "@/lib/auto-charge";

export async function POST(
  request: Request,
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
    return NextResponse.json({ error: "Cannot enable auto-charge on a paid invoice" }, { status: 400 });
  }

  const body = await request.json();
  const { enabled } = body;

  if (enabled) {
    const usage = await canAutoCharge(user.id);
    if (!usage.allowed) {
      return NextResponse.json(
        { error: "Monthly auto-charge limit reached", used: usage.used, limit: usage.limit },
        { status: 403 },
      );
    }

    const hasPaymentMethod = await prisma.clientPaymentMethod.findFirst({
      where: { userId: user.id, clientEmail: invoice.clientEmail, status: "active" },
    });

    if (!hasPaymentMethod) {
      return NextResponse.json({ error: "No saved payment method for this client" }, { status: 400 });
    }
  }

  await prisma.invoice.update({
    where: { id },
    data: {
      autoCharge: enabled,
      autoChargeRetryCount: enabled ? 0 : invoice.autoChargeRetryCount,
      autoChargeLastError: enabled ? null : invoice.autoChargeLastError,
    },
  });

  return NextResponse.json({ autoCharge: enabled });
}
