import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const accessId = searchParams.get("id");
  if (!accessId) {
    return NextResponse.json({ error: "Access ID is required" }, { status: 400 });
  }

  const access = await prisma.accountantAccess.findFirst({
    where: { id: accessId, ownerId: user.id },
  });
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.accountantAccess.update({
    where: { id: access.id },
    data: { status: "revoked", revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
