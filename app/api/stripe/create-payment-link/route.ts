import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const { invoiceId } = body;

  if (!invoiceId) {
    return Response.json({ error: "Invoice ID is required" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    return Response.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.userId !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (invoice.status === "paid" || invoice.status === "cancelled") {
    return Response.json(
      { error: "Cannot create payment link for paid or cancelled invoices" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const plan = await prisma.paymentPlan.findUnique({
    where: { invoiceId },
    include: { installmentsList: { orderBy: { dueDate: "asc" } } },
  });

  if (plan && plan.status === "active") {
    return Response.json({
      url: `${baseUrl}/pay/${invoiceId}`,
      plan: {
        installments: plan.installmentsList.map((i) => ({
          amount: i.amount,
          dueDate: i.dueDate.toISOString(),
          status: i.status,
        })),
      },
    });
  }

  if (invoice.paymentLink) {
    return Response.json({ url: invoice.paymentLink });
  }

  const ref = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : "";
  const productName = `Invoice${ref} - ${invoice.clientName}`;

  const stripe = getStripe();
  const paymentLink = await stripe.paymentLinks.create({
    line_items: [
      {
        price_data: {
          currency: invoice.currency.toLowerCase(),
          unit_amount: Math.round(invoice.amount * 100),
          product_data: {
            name: productName,
            description: invoice.notes || undefined,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoiceId: invoice.id,
    },
    after_completion: {
      type: "redirect",
      redirect: { url: `${baseUrl}/pay/success?invoiceId=${invoice.id}` },
    },
    allow_promotion_codes: false,
    billing_address_collection: "auto",
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentLink: paymentLink.url },
  });

  return Response.json({ url: paymentLink.url });
}
