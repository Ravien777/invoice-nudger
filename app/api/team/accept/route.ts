import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL(`/team/accept?token=${token}`, baseUrl));
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { inviteToken: token },
  });
  if (!teamMember) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
  }
  if (teamMember.status !== "pending") {
    return NextResponse.json({ error: "This invitation is no longer valid" }, { status: 400 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "You must be logged in to accept an invitation" }, { status: 401 });
  }

  if (session.user.email !== teamMember.memberEmail) {
    return NextResponse.json({ error: "This invitation was sent to a different email address" }, { status: 403 });
  }

  const memberUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  await prisma.teamMember.update({
    where: { id: teamMember.id },
    data: {
      status: "active",
      memberUserId: memberUser?.id ?? null,
      acceptedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, status: "active" });
}
