import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { quoteSchema } from "@/lib/validations";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { signQuoteToken } from "@/lib/quote-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  const effectiveUserId = accountantOwnerId ?? user.id;

  const quote = await prisma.quote.findFirst({
    where: { id, userId: effectiveUserId },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (quote.status === "sent" && quote.expiryDate && quote.expiryDate <= new Date()) {
    await prisma.quote.update({ where: { id }, data: { status: "expired" } });
    quote.status = "expired";
  }

  return NextResponse.json({ quote });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id, userId: user.id },
    include: { lineItems: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (quote.status !== "draft") {
    return NextResponse.json({ error: "Only draft quotes can be edited" }, { status: 400 });
  }

  const body = await req.json();

  // Status-only update (e.g., "send" action)
  if (Object.keys(body).length === 1 && body.status) {
    const updated = await prisma.quote.update({
      where: { id },
      data: { status: body.status },
    });

    if (body.status === "sent") {
      try {
        const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
        const token = signQuoteToken(id);
        const quoteLink = `${baseUrl}/quote/${id}?token=${token}`;
        const resend = (await import("resend")).Resend;
        const client = new resend(process.env.RESEND_API_KEY ?? "");
        await client.emails.send({
          from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
          to: updated.clientEmail,
          subject: `Quote from ${updated.sellerName || "Maroni"}`,
          html: `
            <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
              <p>Hi ${updated.clientName},</p>
              <p>You've received a quote for <strong>${new Intl.NumberFormat("en-US", { style: "currency", currency: updated.currency }).format(updated.amount)}</strong>.</p>
              ${updated.notes ? `<p>${updated.notes}</p>` : ""}
              <p style="margin-top: 24px;">
                <a href="${quoteLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">View Quote</a>
              </p>
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If you have any questions, feel free to reply to this email.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send quote email:", emailErr);
      }
    }

    return NextResponse.json({ quote: updated });
  }

  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { lineItems, ...data } = parsed.data;

  await prisma.quoteLineItem.deleteMany({ where: { quoteId: id } });

  const updated = await prisma.quote.update({
    where: { id },
    data: {
      ...data,
      issueDate: new Date(data.issueDate),
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      lineItems: {
        create: lineItems.map((item, i) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? null,
          taxAmount: item.taxAmount ?? null,
          total: item.total,
          sortOrder: i,
        })),
      },
    },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ quote: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const accountantOwnerId = await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const quote = await prisma.quote.findFirst({
    where: { id, userId: user.id },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (quote.status !== "draft" && quote.status !== "declined") {
    return NextResponse.json({ error: "Only draft or declined quotes can be deleted" }, { status: 400 });
  }

  await prisma.quote.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
