import { PrismaAdapter } from "@next-auth/prisma-adapter";
import EmailProvider from "next-auth/providers/email";
import { Resend } from "resend";
import { prisma } from "./prisma";
import { seedDefaultSchedule } from "./seed";
import type { NextAuthOptions } from "next-auth";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

const MAGIC_LINK_FILE = join(process.cwd(), "magic-link.txt");

function writeMagicLinkToFile(email: string, url: string) {
  try {
    const dir = dirname(MAGIC_LINK_FILE);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(MAGIC_LINK_FILE, `${email}\n${url}\n`);
  } catch {
    // Ignore file write errors
  }
}

async function sendVerificationRequest({
  identifier: email,
  url,
  provider,
}: {
  identifier: string;
  url: string;
  provider: { from: string };
}) {
  writeMagicLinkToFile(email, url);

  try {
    const { data, error } = await resend.emails.send({
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

    if (error) {
      console.error("[Resend] API error:", JSON.stringify(error));
    } else {
      console.log("[Resend] Email sent, id:", data?.id);
    }
  } catch (err) {
    console.error("[Resend] Failed to send:", err);
  }

  console.log("");
  console.log("========================================");
  console.log("  MAGIC LINK for:", email);
  console.log("  " + url);
  console.log("========================================");
  console.log("");
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
  callbacks: {
    async signIn({ user }) {
      // Ensure we use the persisted Prisma user id when seeding the default schedule.
      // `user` may be a NextAuth user object that doesn't map 1:1 to the DB row
      // in some edge cases, so prefer looking up the user by email first.
      if (user?.email) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          });
          const userId = dbUser?.id ?? user.id;
          if (userId) await seedDefaultSchedule(userId);
        } catch (err) {
          console.error("Failed to seed default schedule:", err);
        }
      }
      return true;
    },
  },
};
