import { randomBytes } from "crypto";
import { prisma } from "./prisma";

export interface PortalBranding {
  businessName?: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  tagline?: string | null;
  faviconUrl?: string | null;
}

export function generatePortalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getPortalUrl(token: string): string {
  return `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/portal/${token}`;
}

export async function createPortalToken(
  userId: string,
  clientEmail: string,
  options?: { clientName?: string; expiresAt?: Date }
) {
  const token = generatePortalToken();

  const record = await prisma.clientPortalToken.create({
    data: {
      token,
      userId,
      clientEmail,
      clientName: options?.clientName ?? null,
      expiresAt: options?.expiresAt ?? null,
    },
  });

  return {
    id: record.id,
    token: record.token,
    clientEmail: record.clientEmail,
    clientName: record.clientName,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    portalUrl: `${process.env.NEXTAUTH_URL}/portal/${record.token}`,
  };
}

export async function getPortalTokens(userId: string) {
  const tokens = await prisma.clientPortalToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return tokens.map((t) => ({
    id: t.id,
    token: t.token,
    clientEmail: t.clientEmail,
    clientName: t.clientName,
    isActive: t.isActive,
    expiresAt: t.expiresAt,
    lastAccessedAt: t.lastAccessedAt,
    createdAt: t.createdAt,
    portalUrl: `${process.env.NEXTAUTH_URL}/portal/${t.token}`,
    isExpired: t.expiresAt ? t.expiresAt < new Date() : false,
  }));
}

export async function revokePortalToken(userId: string, tokenId: string) {
  const existing = await prisma.clientPortalToken.findUnique({
    where: { id: tokenId },
  });

  if (!existing || existing.userId !== userId) {
    return null;
  }

  const updated = await prisma.clientPortalToken.update({
    where: { id: tokenId },
    data: { isActive: false },
  });

  return updated;
}

export async function validatePortalToken(token: string) {
  const record = await prisma.clientPortalToken.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          portalEnabled: true,
          portalBranding: true,
        },
      },
    },
  });

  if (!record || !record.isActive) {
    return null;
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    return null;
  }

  await prisma.clientPortalToken.update({
    where: { id: record.id },
    data: { lastAccessedAt: new Date() },
  });

  const branding: PortalBranding = record.user.portalBranding
    ? JSON.parse(record.user.portalBranding)
    : {};

  if (!branding.businessName && record.user.name) {
    branding.businessName = record.user.name;
  }

  return {
    clientEmail: record.clientEmail,
    clientName: record.clientName,
    userId: record.user.id,
    branding,
  };
}

export async function getClientInvoices(userId: string, clientEmail: string) {
  const invoices = await prisma.invoice.findMany({
    where: {
      userId,
      clientEmail,
    },
    orderBy: { dueDate: "desc" },
  });

  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    projectName: inv.projectName,
    amount: inv.amount,
    currency: inv.currency,
    dueDate: inv.dueDate,
    status: inv.status,
    notes: inv.notes,
    paymentLink: inv.paymentLink,
    paidAt: inv.paidAt,
    createdAt: inv.createdAt,
  }));
}
