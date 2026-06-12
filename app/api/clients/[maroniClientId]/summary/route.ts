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

  const invoices = await prisma.invoice.findMany({
    where: { clientEmail: client.email },
    select: { amount: true, status: true },
  });

  let totalBilled = 0;
  let totalPaid = 0;
  let outstanding = 0;

  for (const inv of invoices) {
    totalBilled += inv.amount;
    if (inv.status === "paid") {
      totalPaid += inv.amount;
    } else if (inv.status === "pending" || inv.status === "overdue" || inv.status === "unpaid") {
      outstanding += inv.amount;
    }
  }

  return NextResponse.json({ totalBilled, totalPaid, outstanding });
}
