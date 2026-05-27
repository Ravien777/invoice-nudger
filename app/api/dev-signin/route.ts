import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { seedDefaultSchedule, seedSampleInvoices } from "@/lib/seed";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: { email, name: email.split("@")[0], plan: "agency" },
    });
    await seedDefaultSchedule(user.id);
    await seedSampleInvoices(user.id);
  }

  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const sessionToken = crypto.randomUUID();

  await prisma.session.create({
    data: {
      userId: user.id,
      sessionToken,
      expires,
    },
  });

  const response = NextResponse.json({
    success: true,
    email: user.email,
  });

  response.cookies.set("next-auth.session-token", sessionToken, {
    httpOnly: true,
    path: "/",
    expires,
    sameSite: "lax",
  });

  return response;
}
