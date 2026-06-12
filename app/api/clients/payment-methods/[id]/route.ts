import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params;

  const method = await prisma.clientPaymentMethod.findUnique({
    where: { id },
  });

  if (!method || method.userId !== user.id) {
    return NextResponse.json({ error: "Payment method not found" }, { status: 404 });
  }

  await prisma.clientPaymentMethod.update({
    where: { id },
    data: { status: "removed" },
  });

  return NextResponse.json({ success: true });
}
