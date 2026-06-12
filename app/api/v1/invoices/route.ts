import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = { userId: auth.userId };
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        clientEmail: true,
        amount: true,
        currency: true,
        status: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
        notes: true,
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({ data: invoices, total, limit, offset });
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { clientName, clientEmail, amount, currency, dueDate, notes, invoiceNumber, clientPhone } = body;

  if (!clientName || !clientEmail || !amount || !dueDate) {
    return NextResponse.json({ error: "clientName, clientEmail, amount, and dueDate are required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.create({
    data: {
      userId: auth.userId,
      clientName,
      clientEmail,
      clientPhone: clientPhone ?? null,
      amount: parseFloat(amount),
      currency: currency ?? "USD",
      dueDate: new Date(dueDate),
      notes: notes ?? null,
      invoiceNumber: invoiceNumber ?? null,
    },
  });

  return NextResponse.json({ data: invoice }, { status: 201 });
}
