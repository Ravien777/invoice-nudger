import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const promiseEvent = await prisma.promiseEvent.findUnique({
    where: { id },
    include: { invoice: true },
  });

  if (!promiseEvent || promiseEvent.invoice.userId !== user.id) {
    return NextResponse.json({ error: "Promise not found" }, { status: 404 });
  }

  const body = await request.json();
  const { action, promisedDate } = body;

  if (!action) {
    return NextResponse.json({ error: "action is required" }, { status: 400 });
  }

  let updatedPromise;
  let updatedInvoice;

  switch (action) {
    case "approve":
      updatedPromise = await prisma.promiseEvent.update({
        where: { id },
        data: {
          status: "active",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      updatedInvoice = await prisma.invoice.update({
        where: { id: promiseEvent.invoiceId },
        data: {
          promiseStatus: "active",
        },
      });
      break;

    case "reject":
      updatedPromise = await prisma.promiseEvent.update({
        where: { id },
        data: {
          status: "overridden",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      updatedInvoice = await prisma.invoice.update({
        where: { id: promiseEvent.invoiceId },
        data: {
          promiseStatus: "none",
          promisedDate: null,
          promiseConfidence: null,
        },
      });
      break;

    case "override":
      if (!promisedDate) {
        return NextResponse.json({ error: "promisedDate is required for override" }, { status: 400 });
      }

      updatedPromise = await prisma.promiseEvent.update({
        where: { id },
        data: {
          promisedDate: new Date(promisedDate),
          status: "active",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      updatedInvoice = await prisma.invoice.update({
        where: { id: promiseEvent.invoiceId },
        data: {
          promisedDate: new Date(promisedDate),
          promiseStatus: "active",
        },
      });
      break;

    case "mark-fulfilled":
      updatedPromise = await prisma.promiseEvent.update({
        where: { id },
        data: {
          status: "fulfilled",
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });

      updatedInvoice = await prisma.invoice.update({
        where: { id: promiseEvent.invoiceId },
        data: {
          promiseStatus: "fulfilled",
        },
      });
      break;

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return NextResponse.json({
    promise: updatedPromise,
    invoice: updatedInvoice,
  });
}
