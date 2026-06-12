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
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    invoices: invoices.map((inv) => ({
      id: inv.id,
      number: inv.invoiceNumber || `INV-${inv.id.slice(0, 8)}`,
      amount: inv.amount,
      status: inv.status,
      date: inv.createdAt.toISOString().slice(0, 10),
      url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/invoices/${inv.id}`,
    })),
  });
}
