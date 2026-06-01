import { NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import { seedDefaultSchedule, seedSampleInvoices } from "@/lib/seed";

function isLocalRequest(request: Request): boolean {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  return ip === "::1" || ip === "127.0.0.1" || ip === "localhost" || ip.startsWith("192.168.") || ip.startsWith("10.") || ip.startsWith("172.16.");
}

function guardDevAccess(request: Request): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Localhost only" }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const guard = guardDevAccess(request);
  if (guard) return guard;

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const guard = guardDevAccess(request);
  if (guard) return guard;

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: { email, name: email.split("@")[0], plan: "agency", emailVerified: new Date() },
    });
    await seedDefaultSchedule(user.id);
    await seedSampleInvoices(user.id);
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "NEXTAUTH_SECRET not set" }, { status: 500 });
  }

  const token = {
    sub: user.id,
    email: user.email,
    name: user.name,
    id: user.id,
  };

  const jwt = await encode({ token, secret });

  const response = NextResponse.json({
    success: true,
    email: user.email,
  });

  response.cookies.set("next-auth.session-token", jwt, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
