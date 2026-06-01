import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password";
import { sendAuthEmail } from "@/lib/auth-email";
import { signupSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`signup:${ip}`, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      emailVerified: null,
    },
  });

  const token = crypto.randomUUID();
  await prisma.verificationToken.create({
    data: {
      identifier: user.email,
      token,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || `http://localhost:${process.env.PORT || 3000}`;
  const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${token}`;

  await sendAuthEmail({
    to: user.email,
    subject: "Verify your email",
    linkLabel: "Verification link",
    linkUrl: verifyUrl,
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #111; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Verify your email</h1>
        <p style="margin-bottom: 24px;">Click the link below to verify your email address and activate your account.</p>
        <a href="${verifyUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: white; border-radius: 8px; text-decoration: none;">Verify email</a>
        <p style="margin-top: 24px; color: #666;">This link expires in 24 hours. If you did not create an account, you can ignore this email.</p>
      </div>
    `,
  });

  return NextResponse.json({ success: true });
}
