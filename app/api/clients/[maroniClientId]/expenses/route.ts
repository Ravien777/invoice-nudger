import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/plazaos-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ maroniClientId: string }> }
) {
  const authError = validateApiKey(_request);
  if (authError) return authError;

  const { maroniClientId } = await params;

  const client = await prisma.plazaosClient.findUnique({
    where: { id: maroniClientId },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const expenses = await prisma.expense.findMany({
    where: { clientEmail: client.email },
    orderBy: { date: "desc" },
    select: {
      id: true,
      description: true,
      amount: true,
      date: true,
      category: { select: { name: true } },
    },
  });

  return NextResponse.json({
    expenses: expenses.map((exp) => ({
      id: exp.id,
      description: exp.description,
      amount: exp.amount,
      category: exp.category?.name ?? "Uncategorized",
      date: exp.date.toISOString().slice(0, 10),
    })),
  });
}
