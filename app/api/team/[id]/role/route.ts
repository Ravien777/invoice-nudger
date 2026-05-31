import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
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
    return NextResponse.json({ error: "Only the account owner can change team member roles" }, { status: 403 });
  }

  const body = await req.json();
  const { role } = body as { role?: string };

  if (role !== "member" && role !== "viewer") {
    return NextResponse.json({ error: "Role must be 'member' or 'viewer'" }, { status: 400 });
  }

  await prisma.teamMember.update({
    where: { id },
    data: { role },
  });

  return NextResponse.json({ success: true, role });
}
