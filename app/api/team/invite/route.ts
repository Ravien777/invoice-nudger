import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { teamInviteEmail } from "@/lib/email-templates/team_invite";
import { canAddTeamMembers } from "@/lib/subscriptions";
import { getTier } from "@/lib/tiers";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function POST(req: NextRequest) {
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

  const hasTeamAccess = await canAddTeamMembers(user.id);
  if (!hasTeamAccess) {
    return NextResponse.json({ error: "Team members are only available on the Agency plan" }, { status: 403 });
  }

  const body = await req.json();
  const { email, role } = body as { email?: string; role?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const memberRole = role === "viewer" ? "viewer" : "member";

  const tier = getTier(user.plan);
  const maxSeats = tier.teamSeats;

  const activeCount = await prisma.teamMember.count({
    where: { ownerId: user.id, status: { not: "removed" } },
  });

  if (activeCount + 1 > maxSeats) {
    return NextResponse.json({ error: `Maximum ${maxSeats} team seats reached.` }, { status: 400 });
  }

  const existing = await prisma.teamMember.findUnique({
    where: { ownerId_memberEmail: { ownerId: user.id, memberEmail: email } },
  });
  if (existing && existing.status !== "removed") {
    return NextResponse.json({ error: "This person already has a pending or active invitation" }, { status: 409 });
  }

  const inviteToken = randomUUID();

  if (existing) {
    await prisma.teamMember.update({
      where: { id: existing.id },
      data: { status: "pending", role: memberRole, inviteToken, invitedAt: new Date(), acceptedAt: null, removedAt: null },
    });
  } else {
    await prisma.teamMember.create({
      data: { ownerId: user.id, memberEmail: email, role: memberRole, inviteToken },
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/api/team/accept?token=${inviteToken}`;

  const emailContent = teamInviteEmail({
    ownerName: user.name || "A user",
    ownerEmail: user.email,
    role: memberRole,
    inviteUrl,
  });

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send email" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, status: "pending" });
}
