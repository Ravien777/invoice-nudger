import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function acceptByToken(token: string, sessionEmail: string) {
  const access = await prisma.accountantAccess.findUnique({
    where: { inviteToken: token },
  });
  if (!access) {
    return { error: "Invalid invite token", status: 404 as const };
  }
  if (access.status !== "pending") {
    return { error: "This invitation is no longer valid", status: 410 as const };
  }
  if (access.accountantEmail !== sessionEmail) {
    return { error: "This invitation was sent to a different email address", status: 403 as const };
  }

  const accountant = await prisma.user.findUnique({
    where: { email: sessionEmail },
  });

  await prisma.accountantAccess.update({
    where: { id: access.id },
    data: {
      status: "active",
      acceptedAt: new Date(),
      accountantUserId: accountant?.id ?? null,
    },
  });

  return { success: true, ownerId: access.ownerId };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  const result = await acceptByToken(token, session.user.email);
  if ("error" in result) {
    return new Response(result.error, { status: result.status });
  }

  const ownerUrl = new URL(`/accountant/${result.ownerId}`, req.url);
  return NextResponse.redirect(ownerUrl);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Invite token is required" }, { status: 400 });
  }

  const result = await acceptByToken(token, session.user.email);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, ownerId: result.ownerId });
}
