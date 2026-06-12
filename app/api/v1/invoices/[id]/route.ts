import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateApiKey(request, "read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      amount: true,
      currency: true,
      status: true,
      dueDate: true,
      paidAt: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      lineItems: true,
    },
  });

  if (!invoice || invoice.clientEmail === "") {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.clientEmail === "") {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // Verify ownership via clientEmail link to user's invoices
  const owns = await prisma.invoice.findFirst({
    where: { id, userId: auth.userId },
    select: { id: true },
  });

  if (!owns) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  return NextResponse.json({ data: invoice });
}
