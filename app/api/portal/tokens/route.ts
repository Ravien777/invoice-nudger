import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseClientPortal } from "@/lib/subscriptions";
import { createPortalToken, getPortalTokens } from "@/lib/portal";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

export async function GET() {
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

  const tokens = await getPortalTokens(effectiveUserId);

  return NextResponse.json({ tokens });
}

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
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const hasAccess = await canUseClientPortal(user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client portal requires Pro or Agency plan" }, { status: 403 });
  }

  const body = await request.json();
  const { clientEmail, clientName, expiresAt } = body;

  if (!clientEmail || typeof clientEmail !== "string") {
    return NextResponse.json({ error: "clientEmail is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  let expiresAtDate: Date | undefined;
  if (expiresAt) {
    expiresAtDate = new Date(expiresAt);
    if (isNaN(expiresAtDate.getTime())) {
      return NextResponse.json({ error: "Invalid expiresAt date" }, { status: 400 });
    }
  }

  const result = await createPortalToken(user.id, clientEmail, {
    clientName: clientName || undefined,
    expiresAt: expiresAtDate,
  });

  return NextResponse.json(result, { status: 201 });
}
