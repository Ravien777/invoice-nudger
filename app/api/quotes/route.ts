import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quoteSchema } from "@/lib/validations";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

export async function GET(request: Request) {
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
  const effectiveUserId = accountantOwnerId ?? user.id;

  await prisma.quote.updateMany({
    where: {
      userId: effectiveUserId,
      status: "sent",
      expiryDate: { lte: new Date() },
    },
    data: { status: "expired" },
  });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const quotes = await prisma.quote.findMany({
    where: { userId: effectiveUserId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      quoteNumber: true,
      clientName: true,
      clientEmail: true,
      clientAddress: true,
      issueDate: true,
      expiryDate: true,
      status: true,
      amount: true,
      subtotal: true,
      totalTax: true,
      currency: true,
      notes: true,
      sellerName: true,
      sellerAddress: true,
      sellerTaxId: true,
      paymentTerms: true,
      convertedToInvoiceId: true,
      createdAt: true,
      updatedAt: true,
      lineItems: { orderBy: { sortOrder: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, taxRate: true, taxAmount: true, total: true, sortOrder: true } },
    },
  });

  return NextResponse.json({ quotes }, {
    headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
  });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const count = await prisma.quote.count({ where: { userId: user.id } });
  const quoteNumber = `Q-${String(count + 1).padStart(3, "0")}`;

  const { lineItems, ...data } = parsed.data;

  const quote = await prisma.quote.create({
    data: {
      ...data,
      issueDate: new Date(data.issueDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      userId: user.id,
      quoteNumber,
      lineItems: {
        create: lineItems.map((item, i) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? null,
          taxAmount: item.taxAmount ?? null,
          total: item.total,
          sortOrder: i,
        })),
      },
    },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ quote }, { status: 201 });
}
