import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { createPaymentRecord } from "@/lib/reconciliation";
import { createAllocationRecord } from "@/lib/allocation";

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "");
}

function getPlanFromPriceId(priceId: string): string {
  const proPrice = process.env.STRIPE_PRO_PRICE_ID || "";
  const agencyPrice = process.env.STRIPE_AGENCY_PRICE_ID || "";

  if (priceId === proPrice) return "pro";
  if (priceId === agencyPrice) return "agency";
  return "free";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode === "subscription") {
      const userId = session.metadata?.userId;
      const subscriptionId = session.subscription as string | undefined;
      const priceId = session.line_items?.data[0]?.price?.id;

      if (userId) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: subscriptionId || null,
            stripePriceId: priceId || null,
            subscriptionStatus: "active",
            plan: priceId ? getPlanFromPriceId(priceId) : "free",
          },
        });
      }
    }

    if (session.mode === "payment") {
      const invoiceId = session.metadata?.invoiceId;

      if (invoiceId) {
        const invoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
        });

        if (invoice && invoice.status !== "paid") {
          const expectedAmount = Math.round(invoice.amount * 100);
          if (session.amount_total !== expectedAmount) {
            console.warn(
              `Amount mismatch for invoice ${invoiceId}: expected ${expectedAmount}, got ${session.amount_total}`
            );
          }

          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: "paid",
              paidAt: new Date(),
            },
          });

          await createPaymentRecord({
            invoiceId,
            source: "stripe",
            amount: invoice.amount,
            currency: invoice.currency,
            paidAt: new Date(),
            referenceId: session.payment_intent as string | undefined,
          });

          await prisma.reminderLog.create({
            data: {
              invoiceId,
              stepName: "auto_paid",
            },
          });

          await createAllocationRecord(
            invoice.userId,
            invoice.amount,
            invoice.currency,
            invoice.id,
            invoice.clientName,
          );
        }
      }
    }

    return new Response("OK");
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId = subscription.metadata?.userId;

    if (!userId) {
      const customerId = subscription.customer as string;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });

      if (!user) {
        return new Response("OK");
      }

      const priceId = subscription.items.data[0]?.price?.id;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || null,
          subscriptionStatus: subscription.status,
          plan: priceId ? getPlanFromPriceId(priceId) : "free",
        },
      });
    } else {
      const priceId = subscription.items.data[0]?.price?.id;
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId || null,
          subscriptionStatus: subscription.status,
          plan: priceId ? getPlanFromPriceId(priceId) : "free",
        },
      });
    }

    return new Response("OK");
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = subscription.customer as string;

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeSubscriptionId: null,
          stripePriceId: null,
          subscriptionStatus: "canceled",
          plan: "free",
        },
      });
    }

    return new Response("OK");
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const invoiceId = charge.metadata?.invoiceId;

    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (invoice) {
        await createPaymentRecord({
          invoiceId,
          source: "stripe",
          amount: charge.amount / 100,
          currency: charge.currency?.toUpperCase() ?? invoice.currency,
          paidAt: new Date(charge.created * 1000),
          referenceId: charge.id,
          status: "refunded",
          notes: `Refunded via Stripe: ${charge.id}`,
        });
      }
    }

    return new Response("OK");
  }

  if (event.type === "invoice.payment_succeeded") {
    const invoiceObj = event.data.object as unknown as Record<string, unknown>;
    const customerId = invoiceObj.customer as string;

    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
    });

    if (user) {
      const subscriptionId = invoiceObj.subscription as string | undefined;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: "active",
          ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
        },
      });
    }

    return new Response("OK");
  }

  return new Response("OK");
}
