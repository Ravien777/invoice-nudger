import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateApiKey } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "read");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = { userId: auth.userId };
  if (category) where.categoryId = category;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        description: true,
        amount: true,
        currency: true,
        date: true,
        categoryId: true,
        receiptUrl: true,
        notes: true,
        vendor: true,
      },
    }),
    prisma.expense.count({ where }),
  ]);

  return NextResponse.json({ data: expenses, total, limit, offset });
}

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request, "write");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { description, amount, date, currency, categoryId, notes, vendor } = body;

  if (!description || !amount || !date) {
    return NextResponse.json({ error: "description, amount, and date are required" }, { status: 400 });
  }

  const expense = await prisma.expense.create({
    data: {
      userId: auth.userId,
      description,
      amount: parseFloat(amount),
      currency: currency ?? "USD",
      date: new Date(date),
      categoryId: categoryId ?? null,
      notes: notes ?? null,
      vendor: vendor ?? null,
    },
  });

  return NextResponse.json({ data: expense }, { status: 201 });
}
