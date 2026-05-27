import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { accountantInviteEmail } from "@/lib/email-templates/accountant_invite";
import { randomUUID } from "crypto";

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

  const body = await req.json();
  const { email } = body as { email?: string };
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const existing = await prisma.accountantAccess.findUnique({
    where: { ownerId_accountantEmail: { ownerId: user.id, accountantEmail: email } },
  });
  if (existing && existing.status !== "revoked") {
    return NextResponse.json({ error: "This accountant already has access" }, { status: 409 });
  }

  const inviteToken = randomUUID();

  if (existing) {
    await prisma.accountantAccess.update({
      where: { id: existing.id },
      data: { status: "pending", inviteToken, invitedAt: new Date(), acceptedAt: null, revokedAt: null },
    });
  } else {
    await prisma.accountantAccess.create({
      data: { ownerId: user.id, accountantEmail: email, inviteToken },
    });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/api/accountant/accept?token=${inviteToken}`;

  const emailContent = accountantInviteEmail({
    ownerName: user.name || "A user",
    ownerEmail: user.email,
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
