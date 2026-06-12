import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {
    invoice: { userId: effectiveUserId },
  };

  if (status) {
    where.status = status;
  }

  const plans = await prisma.paymentPlan.findMany({
    where,
    include: {
      installmentsList: { orderBy: { dueDate: "asc" } },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          clientEmail: true,
          amount: true,
          currency: true,
          status: true,
          dueDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ plans });
}
