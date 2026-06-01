import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendAuthEmail } from "@/lib/auth-email";
import { forgotPasswordSchema } from "@/lib/validations";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`forgot-password:${ip}`, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    const token = crypto.randomUUID();
    await prisma.verificationToken.create({
      data: {
        identifier: user.email,
        token,
        expires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL ||
      `http://localhost:${process.env.PORT || 3000}`;
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`;

    await sendAuthEmail({
      to: user.email,
      subject: "Reset your password",
      linkLabel: "Password reset link",
      linkUrl: resetUrl,
      html: `
        <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #111; padding: 24px;">
          <h1 style="font-size: 20px; margin-bottom: 16px;">Reset your password</h1>
          <p style="margin-bottom: 24px;">Click the link below to set a new password for your account.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: white; border-radius: 8px; text-decoration: none;">Reset password</a>
          <p style="margin-top: 24px; color: #666;">This link expires in 1 hour. If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ success: true });
}
