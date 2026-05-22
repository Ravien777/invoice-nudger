import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveDiscrepancy } from "@/lib/reconciliation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ invoiceId: string }> }
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

  const { invoiceId } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action } = body;

  if (!["force_reconcile", "mark_discrepancy", "ignore"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  await resolveDiscrepancy(invoiceId, action);

  return NextResponse.json({ success: true });
}
