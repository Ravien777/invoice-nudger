import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { canUseClientPortal } from "@/lib/subscriptions";

const portalBrandingSchema = z.object({
  businessName: z.string().max(100).optional(),
  logoUrl: z.string().max(500).url().nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  tagline: z.string().max(200).nullable().optional(),
  faviconUrl: z.string().max(500).nullable().optional(),
}).optional();

const portalSchema = z.object({
  enabled: z.boolean(),
  branding: portalBrandingSchema,
});

export async function PUT(request: Request) {
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

  const hasAccess = await canUseClientPortal(user.id);
  if (!hasAccess) {
    return NextResponse.json({ error: "Client portal requires Pro or Agency plan" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = portalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { enabled, branding } = parsed.data;
  const existingBranding = user.portalBranding ? JSON.parse(user.portalBranding) : {};
  const mergedBranding = { ...existingBranding, ...branding };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      portalEnabled: enabled,
      portalBranding: JSON.stringify(mergedBranding),
    },
  });

  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, portalEnabled: true, portalBranding: true, name: true, plan: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const branding = user.portalBranding ? JSON.parse(user.portalBranding) : {};
  if (!branding.businessName && user.name) {
    branding.businessName = user.name;
  }

  return NextResponse.json({
    enabled: user.portalEnabled,
    branding,
    hasAccess: await canUseClientPortal(user.id),
  });
}
