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

  const methods = await prisma.clientPaymentMethod.findMany({
    where: {
      userId: effectiveUserId,
      clientEmail,
      status: "active",
    },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ paymentMethods: methods });
}
