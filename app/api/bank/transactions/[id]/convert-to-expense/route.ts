import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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

  const { id } = await params;

  const tx = await prisma.bankTransaction.findFirst({
    where: { id, userId: user.id },
  });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (tx.status !== "unmatched") {
    return NextResponse.json({ error: "Transaction is not in unmatched status" }, { status: 400 });
  }

  if (tx.amount >= 0) {
    return NextResponse.json({ error: "Only debit transactions can be converted to expenses" }, { status: 400 });
  }

  if (tx.matchedInvoiceId || tx.matchedExpenseId) {
    return NextResponse.json({ error: "Transaction is already matched" }, { status: 400 });
  }

  const categoryName = tx.category ?? "Other";
  let category = await prisma.expenseCategory.findFirst({
    where: { userId: user.id, name: categoryName },
  });
  if (!category) {
    category = await prisma.expenseCategory.findFirst({
      where: { userId: user.id, name: "Other" },
    });
  }

  const absAmount = Math.abs(tx.amount);

  const expense = await prisma.expense.create({
    data: {
      userId: user.id,
      description: tx.description,
      amount: absAmount,
      currency: tx.currency,
      date: tx.date,
      vendor: null,
      notes: `Imported from bank transaction`,
      categoryId: category?.id ?? null,
      status: "confirmed",
    },
  });

  await prisma.bankTransaction.update({
    where: { id: tx.id },
    data: { status: "ignored", matchedExpenseId: expense.id },
  });

  return NextResponse.json({ expense });
}