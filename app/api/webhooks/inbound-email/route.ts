import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { classifyPaymentPromise } from "@/lib/promise-detection";
import { Resend } from "resend";
import crypto from "crypto";

const MAILGUN_WEBHOOK_SIGNING_KEY = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function verifyMailgunSignature(timestamp: string, token: string, signature: string, body: string): boolean {
  if (!MAILGUN_WEBHOOK_SIGNING_KEY) return true;

  const hmac = crypto.createHmac("sha256", MAILGUN_WEBHOOK_SIGNING_KEY);
  hmac.update(`${timestamp}${token}`);
  const expectedSignature = hmac.digest("hex");

  return signature === expectedSignature;
}

async function sendPromiseNotificationEmail(userEmail: string, invoice: any, promisedDate: Date, confidence: number) {
  if (!RESEND_API_KEY) return;

  const resend = new Resend(RESEND_API_KEY);
  const formattedDate = promisedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
    to: userEmail,
    subject: `Payment promise detected — ${invoice.clientName}`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <h2>Payment Promise Detected</h2>
        <p><strong>Client:</strong> ${invoice.clientName}</p>
        <p><strong>Invoice:</strong> ${invoice.invoiceNumber ?? invoice.id}</p>
        <p><strong>Amount:</strong> ${new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.amount)}</p>
        <p><strong>Promised Date:</strong> ${formattedDate}</p>
        <p><strong>Confidence:</strong> ${Math.round(confidence * 100)}%</p>
        <p>Reminders have been paused until the promised date. You can review and override this in your <a href="${process.env.NEXTAUTH_URL}/promises">Promise Dashboard</a>.</p>
      </div>
    `,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();

  const timestamp = formData.get("timestamp") as string;
  const token = formData.get("token") as string;
  const signature = formData.get("signature") as string;
  const bodyPlain = formData.get("body-plain") as string;
  const from = formData.get("from") as string;
  const subject = formData.get("subject") as string;
  const messageHeaders = formData.get("Message-Id") as string;
  const inReplyTo = formData.get("In-Reply-To") as string;
  const references = formData.get("References") as string;

  if (!verifyMailgunSignature(timestamp, token, signature, bodyPlain)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let invoice = null;

  if (inReplyTo || references) {
    const referencedMessageId = inReplyTo || references?.split(" ").pop();
    if (referencedMessageId) {
      const cleanMessageId = referencedMessageId.replace(/^<|>$/g, "");
      const logEntry = await prisma.reminderLog.findFirst({
        where: { messageId: cleanMessageId },
        include: { invoice: true },
      });
      if (logEntry?.invoice) {
        invoice = logEntry.invoice;
      }
    }
  }

  if (!invoice) {
    const senderEmail = from?.match(/<([^>]+)>/)?.[1] ?? from?.split("@")[0];
    if (senderEmail) {
      invoice = await prisma.invoice.findFirst({
        where: {
          clientEmail: { contains: senderEmail, mode: "insensitive" },
          status: { in: ["unpaid", "overdue"] },
        },
        orderBy: { updatedAt: "desc" },
      });
    }
  }

  if (!invoice) {
    return NextResponse.json({ status: "ignored", reason: "No matching invoice found" });
  }

  const user = await prisma.user.findUnique({ where: { id: invoice.userId } });
  if (!user) {
    return NextResponse.json({ status: "ignored", reason: "User not found" });
  }

  const classification = await classifyPaymentPromise(bodyPlain, {
    clientName: invoice.clientName,
    projectName: invoice.projectName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
  });

  if (!classification.isPromise || classification.confidence < 0.5) {
    return NextResponse.json({
      status: "ignored",
      reason: "No payment promise detected or confidence too low",
      confidence: classification.confidence,
    });
  }

  const snippet = bodyPlain.substring(0, 500);

  if (classification.confidence > 0.8) {
    const promisedDate = classification.promisedDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        promisedDate,
        promiseDetectedAt: new Date(),
        promiseStatus: "active",
        promiseConfidence: classification.confidence,
      },
    });

    await prisma.promiseEvent.create({
      data: {
        invoiceId: invoice.id,
        promisedDate,
        emailSubject: subject,
        emailSnippet: snippet,
        confidence: classification.confidence,
        status: "active",
      },
    });

    await sendPromiseNotificationEmail(user.email, invoice, promisedDate, classification.confidence);

    return NextResponse.json({
      status: "auto_paused",
      invoiceId: invoice.id,
      promisedDate,
      confidence: classification.confidence,
    });
  }

  const promisedDate = classification.promisedDate ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      promisedDate,
      promiseDetectedAt: new Date(),
      promiseStatus: "pending_review",
      promiseConfidence: classification.confidence,
    },
  });

  await prisma.promiseEvent.create({
    data: {
      invoiceId: invoice.id,
      promisedDate,
      emailSubject: subject,
      emailSnippet: snippet,
      confidence: classification.confidence,
      status: "pending_review",
    },
  });

  await sendPromiseNotificationEmail(user.email, invoice, promisedDate, classification.confidence);

  return NextResponse.json({
    status: "pending_review",
    invoiceId: invoice.id,
    promisedDate,
    confidence: classification.confidence,
  });
}
