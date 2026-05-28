import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Resend } from "resend";
import { generatePortalToken, getPortalUrl } from "@/lib/portal";
import { canUseClientPortal } from "@/lib/subscriptions";
import { portalInviteEmail } from "@/lib/email-templates/portal_invite";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";

const bodySchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().optional(),
});

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      portalBranding: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const hasAccess = await canUseClientPortal(user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client portal requires Pro or Agency plan" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { clientEmail, clientName } = parsed.data;

  const token = generatePortalToken();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const existing = await prisma.clientPortalToken.findFirst({
    where: { userId: user.id, clientEmail },
  });

  const portalToken = existing
    ? await prisma.clientPortalToken.update({
        where: { id: existing.id },
        data: {
          token,
          expiresAt,
          isActive: true,
          clientName: clientName ?? null,
          lastAccessedAt: null,
        },
      })
    : await prisma.clientPortalToken.create({
        data: {
          userId: user.id,
          clientEmail,
          token,
          expiresAt,
          clientName: clientName ?? null,
        },
      });

  const portalUrl = getPortalUrl(portalToken.token);

  const businessName = user.name ?? "Your Business";

  const { error: emailError } = await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
    to: clientEmail,
    ...portalInviteEmail({
      businessName,
      clientName,
      portalUrl,
    }),
  });

  if (emailError) {
    console.error("Failed to send portal invite email:", emailError);
  }

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "portal_invite",
      title: "Portal link sent",
      message: `Client portal link sent to ${clientEmail}.`,
      metadata: { clientEmail, portalUrl, portalTokenId: portalToken.id },
    },
  });

  return NextResponse.json({
    portalUrl,
    token: {
      id: portalToken.id,
      clientEmail: portalToken.clientEmail,
      expiresAt: portalToken.expiresAt,
    },
  });
}
