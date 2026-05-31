import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getTier(user.plan);
  if (tier.aiRemindersLimit === 0) {
    return NextResponse.json({ error: "Promise detection requires a paid plan" }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const where: Record<string, unknown> = {
    invoice: { userId: user.id },
  };

  if (status && status !== "all") {
    where.status = status;
  }

  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

  const promises = await prisma.promiseEvent.findMany({
    where,
    take: limit,
    include: {
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          clientEmail: true,
          amount: true,
          currency: true,
          dueDate: true,
          status: true,
        },
      },
    },
    orderBy: { detectedAt: "desc" },
  });

  return NextResponse.json({ promises });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { invoiceId, promisedDate, emailSubject, emailSnippet } = body;

  if (!invoiceId || !promisedDate) {
    return NextResponse.json({ error: "invoiceId and promisedDate are required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.userId !== user.id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const promiseEvent = await prisma.promiseEvent.create({
    data: {
      invoiceId,
      promisedDate: new Date(promisedDate),
      emailSubject: emailSubject ?? null,
      emailSnippet: emailSnippet ?? null,
      confidence: 1.0,
      status: "active",
      reviewedBy: user.id,
      reviewedAt: new Date(),
    },
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      promisedDate: new Date(promisedDate),
      promiseDetectedAt: new Date(),
      promiseStatus: "active",
      promiseConfidence: 1.0,
    },
  });

  return NextResponse.json({ promise: promiseEvent });
}
