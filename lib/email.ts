import { Resend } from "resend";
import { prisma } from "./prisma";
import { getTemplate } from "./email-templates";

interface InvoiceWithDetails {
  id: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  dueDate: Date;
  invoiceNumber: string | null;
  paymentLink: string | null;
  accruedFees?: number;
}

interface ReminderStep {
  emailTemplate: string;
}

interface SendOptions {
  aiCopy?: { subject: string; html: string };
  promiseEventId?: string;
}

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function sendReminderEmail(
  invoice: InvoiceWithDetails,
  step: ReminderStep,
  options?: SendOptions
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

  let subject: string;
  let html: string;

  if (options?.aiCopy) {
    subject = options.aiCopy.subject;
    html = options.aiCopy.html;
  } else {
    const templateFn = getTemplate(step.emailTemplate);

    if (!templateFn) {
      return { success: false, error: `Unknown email template: ${step.emailTemplate}` };
    }

    const content = templateFn({
      clientName: invoice.clientName,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      paymentLink,
      accruedFees: invoice.accruedFees,
      feeNote: invoice.accruedFees && invoice.accruedFees > 0
        ? `Includes ${new Intl.NumberFormat("en-US", { style: "currency", currency: invoice.currency }).format(invoice.accruedFees)} in late fees and/or interest.`
        : undefined,
    });

    subject = content.subject;
    html = content.html;
  }

  const mailgunDomain = process.env.MAILGUN_DOMAIN ?? "";
  const customMessageId = `<reminder-${invoice.id}-${step.emailTemplate}-${Date.now()}@${mailgunDomain || "local"}>`;

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      to: invoice.clientEmail,
      subject,
      html,
      headers: {
        "Message-ID": customMessageId,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await prisma.reminderLog.updateMany({
      where: {
        invoiceId: invoice.id,
        stepName: step.emailTemplate,
        aiGenerated: options?.aiCopy ? true : false,
        approved: options?.aiCopy ? true : undefined,
      },
      data: {},
    });

    const logEntry = await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        stepName: step.emailTemplate,
        messageId: customMessageId,
        promiseEventId: options?.promiseEventId ?? null,
      },
    });

    return { success: true, messageId: logEntry.messageId ?? undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send email" };
  }
}
