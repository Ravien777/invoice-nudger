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
  });

  const serialized = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString().split("T")[0],
    description: t.description,
    amount: t.amount,
    currency: t.currency,
    category: t.category,
    matchedInvoiceId: t.matchedInvoiceId,
    matchedExpenseId: t.matchedExpenseId,
    status: t.status,
  }));

  return NextResponse.json(serialized);
}
