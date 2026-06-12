import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { savePaymentMethod, getDefaultPaymentMethod } from "@/lib/auto-charge";

export async function POST(request: Request) {
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

  const body = await request.json();
  const { clientEmail, clientName, stripeCustomerId, stripePaymentMethodId, stripeSetupIntentId } = body;

  if (!clientEmail || !stripeCustomerId || !stripePaymentMethodId) {
    return NextResponse.json({ error: "clientEmail, stripeCustomerId, and stripePaymentMethodId are required" }, { status: 400 });
  }

  const method = await savePaymentMethod({
    userId: effectiveUserId,
    clientEmail,
    clientName,
    stripeCustomerId,
    stripePaymentMethodId,
    stripeSetupIntentId,
  });

  return NextResponse.json({ paymentMethod: method });
}

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
  const clientEmail = searchParams.get("clientEmail");

  const where: Record<string, unknown> = { userId: effectiveUserId, status: "active" };
  if (clientEmail) {
    where.clientEmail = clientEmail;
  }

  const methods = await prisma.clientPaymentMethod.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ paymentMethods: methods });
}
