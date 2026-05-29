import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const teamMember = await prisma.teamMember.findUnique({
    where: { id },
  });
  if (!teamMember) {
    return NextResponse.json({ error: "Team member not found" }, { status: 404 });
  }
  if (teamMember.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the account owner can remove team members" }, { status: 403 });
  }

  await prisma.teamMember.update({
    where: { id },
    data: { status: "removed", removedAt: new Date() },
  });

  return NextResponse.json({ success: true, status: "removed" });
}
