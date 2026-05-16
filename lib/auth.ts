import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { prisma } from "./prisma";
import type { NextAuthOptions } from "next-auth";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

async function sendVerificationRequest({
  identifier: email,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: { from: string };
}) {
  await resend.emails.send({
    from: provider.from,
    to: email,
    subject: "Invoice Nudger sign in",
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #111; padding: 24px;">
        <h1 style="font-size: 20px; margin-bottom: 16px;">Sign in to Invoice Nudger</h1>
        <p style="margin-bottom: 24px;">Use the magic link below to sign in to your account.</p>
        <a href="${url}" style="display: inline-block; padding: 12px 20px; background: #2563eb; color: white; border-radius: 8px; text-decoration: none;">Sign in</a>
        <p style="margin-top: 24px; color: #666;">If you did not request this email, you can ignore it.</p>
      </div>
    `,
  });
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    EmailProvider({
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest(params) {
        await sendVerificationRequest({
          identifier: params.identifier,
          url: params.url,
          provider: { from: params.provider.from },
        });
      },
    }),
  ],
  session: {
    strategy: "database",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
