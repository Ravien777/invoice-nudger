import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUseClientPortal } from "@/lib/subscriptions";

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
  const { enabled, branding } = body;

  if (typeof enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
  }

  const brandingData: Record<string, string> = {};

  if (branding && typeof branding === "object") {
    if (branding.businessName !== undefined) {
      if (typeof branding.businessName !== "string" || branding.businessName.length > 100) {
        return NextResponse.json({ error: "businessName must be a string under 100 characters" }, { status: 400 });
      }
      brandingData.businessName = branding.businessName;
    }
    if (branding.logoUrl !== undefined) {
      if (branding.logoUrl !== null && (typeof branding.logoUrl !== "string" || branding.logoUrl.length > 500)) {
        return NextResponse.json({ error: "logoUrl must be a valid URL under 500 characters" }, { status: 400 });
      }
      brandingData.logoUrl = branding.logoUrl;
    }
    if (branding.accentColor !== undefined) {
      if (branding.accentColor !== null && !/^#[0-9a-fA-F]{6}$/.test(branding.accentColor)) {
        return NextResponse.json({ error: "accentColor must be a valid hex color" }, { status: 400 });
      }
      brandingData.accentColor = branding.accentColor;
    }
    if (branding.tagline !== undefined) {
      if (branding.tagline !== null && (typeof branding.tagline !== "string" || branding.tagline.length > 200)) {
        return NextResponse.json({ error: "tagline must be a string under 200 characters" }, { status: 400 });
      }
      brandingData.tagline = branding.tagline;
    }
    if (branding.faviconUrl !== undefined) {
      if (branding.faviconUrl !== null && (typeof branding.faviconUrl !== "string" || branding.faviconUrl.length > 500)) {
        return NextResponse.json({ error: "faviconUrl must be a valid URL under 500 characters" }, { status: 400 });
      }
      brandingData.faviconUrl = branding.faviconUrl;
    }
  }

  const existingBranding = user.portalBranding ? JSON.parse(user.portalBranding) : {};
  const mergedBranding = { ...existingBranding, ...brandingData };

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
