import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ email: string }> }
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  const effectiveUserId = accountantOwnerId ?? user.id;

  const { email } = await params;
  const clientEmail = decodeURIComponent(email);

  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId: effectiveUserId, clientEmail } },
  });

  if (!profile) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: effectiveUserId, clientEmail },
    orderBy: { dueDate: "desc" },
  });

  const serializedInvoices = invoices.map((inv) => ({
    ...inv,
    dueDate: inv.dueDate.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    paidAt: inv.paidAt?.toISOString() ?? null,
    promisedDate: inv.promisedDate?.toISOString() ?? null,
    lastFeeCalculation: inv.lastFeeCalculation?.toISOString() ?? null,
    lastSyncedAt: inv.lastSyncedAt?.toISOString() ?? null,
    lastReconciledAt: inv.lastReconciledAt?.toISOString() ?? null,
  }));

  return NextResponse.json({
    profile: {
      ...profile,
      updatedAt: profile.updatedAt.toISOString(),
      createdAt: profile.createdAt.toISOString(),
      lastPaymentDate: profile.lastPaymentDate?.toISOString() ?? null,
    },
    invoices: serializedInvoices,
  });
}
