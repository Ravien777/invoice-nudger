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

  const where = { userId: auth.userId };

  const [profiles, total] = await Promise.all([
    prisma.clientPaymentProfile.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        clientEmail: true,
        totalInvoices: true,
        paidInvoices: true,
        totalAmount: true,
        riskScore: true,
        lastPaymentDate: true,
      },
    }),
    prisma.clientPaymentProfile.count({ where }),
  ]);

  return NextResponse.json({ data: profiles, total, limit, offset });
}
