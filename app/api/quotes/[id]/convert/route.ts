import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id, userId: user.id },
    include: { lineItems: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (quote.status !== "sent" && quote.status !== "accepted") {
    return NextResponse.json({ error: "Quote must be sent or accepted to convert" }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId: user.id,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      amount: quote.amount,
      currency: quote.currency,
      dueDate: addDays(new Date(), 30),
      status: "unpaid",
      notes: quote.notes || undefined,
    },
  });

  await prisma.quote.update({
    where: { id },
    data: { convertedToInvoiceId: invoice.id, status: "accepted" },
  });

  return NextResponse.json({ invoiceId: invoice.id });
}
