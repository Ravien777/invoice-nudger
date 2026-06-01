import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 500);

  const transactions = await prisma.bankTransaction.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: limit,
    select: {
      id: true,
      date: true,
      description: true,
      amount: true,
      currency: true,
      category: true,
      matchedInvoiceId: true,
      matchedExpenseId: true,
      status: true,
    },
  });

  const invoiceIds = transactions.filter((t) => t.matchedInvoiceId).map((t) => t.matchedInvoiceId!);
  const expenseIds = transactions.filter((t) => t.matchedExpenseId).map((t) => t.matchedExpenseId!);
  const [invoices, expenses] = await Promise.all([
    invoiceIds.length > 0
      ? prisma.invoice.findMany({
          where: { id: { in: invoiceIds } },
          select: { id: true, clientName: true, invoiceNumber: true },
        })
      : Promise.resolve([]),
    expenseIds.length > 0
      ? prisma.expense.findMany({
          where: { id: { in: expenseIds } },
          select: { id: true, description: true },
        })
      : Promise.resolve([]),
  ]);
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const expenseMap = new Map(expenses.map((e) => [e.id, e]));

  const serialized = transactions.map((t) => {
    let matchedEntityName: string | null = null;
    let matchedEntityHref: string | null = null;
    if (t.matchedInvoiceId) {
      const inv = invoiceMap.get(t.matchedInvoiceId);
      matchedEntityName = inv ? (inv.invoiceNumber ?? inv.clientName) : t.matchedInvoiceId;
      matchedEntityHref = `/invoices/${t.matchedInvoiceId}`;
    } else if (t.matchedExpenseId) {
      const exp = expenseMap.get(t.matchedExpenseId);
      matchedEntityName = exp?.description ?? t.matchedExpenseId;
      matchedEntityHref = `/expenses`;
    }
    return {
      id: t.id,
      date: t.date.toISOString().split("T")[0],
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      category: t.category,
      matchedInvoiceId: t.matchedInvoiceId,
      matchedExpenseId: t.matchedExpenseId,
      matchedEntityName,
      matchedEntityHref,
      status: t.status,
    };
  });

  return NextResponse.json(serialized, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
