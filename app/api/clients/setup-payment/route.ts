import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { getOrCreateStripeCustomer, createSetupIntent } from "@/lib/auto-charge";

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
  const { clientEmail, clientName } = body;

  if (!clientEmail) {
    return NextResponse.json({ error: "clientEmail is required" }, { status: 400 });
  }

  const { stripeCustomerId } = await getOrCreateStripeCustomer(effectiveUserId, clientEmail, clientName);

  const setupIntent = await createSetupIntent(stripeCustomerId);

  return NextResponse.json({
    clientSecret: setupIntent.client_secret,
    setupIntentId: setupIntent.id,
    stripeCustomerId,
  });
}
