import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format-currency";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { action } = body;

  if (action !== "accepted" && action !== "declined") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  if (quote.status !== "sent") {
    return NextResponse.json({ error: "Quote is not in sent status" }, { status: 400 });
  }

  await prisma.quote.update({
    where: { id },
    data: { status: action },
  });

  await prisma.notification.create({
    data: {
      userId: quote.userId,
      type: "quote_response",
      title: action === "accepted" ? "Quote accepted" : "Quote declined",
      message: `${quote.clientName} has ${action === "accepted" ? "accepted" : "declined"} your quote for ${formatCurrency(quote.amount, quote.currency)}.`,
      metadata: { quoteId: id, clientEmail: quote.clientEmail },
    },
  });

  return NextResponse.json({ success: true, status: action });
}
