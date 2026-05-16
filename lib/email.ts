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
}

interface ReminderStep {
  emailTemplate: string;
}

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export async function sendReminderEmail(
  invoice: InvoiceWithDetails,
  step: ReminderStep
): Promise<{ success: boolean; error?: string }> {
  const templateFn = getTemplate(step.emailTemplate);

  if (!templateFn) {
    return { success: false, error: `Unknown email template: ${step.emailTemplate}` };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const paymentLink = `${baseUrl}/pay/${invoice.id}`;

  const { subject, html } = templateFn({
    clientName: invoice.clientName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paymentLink,
  });

  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      to: invoice.clientEmail,
      subject,
      html,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        stepName: step.emailTemplate,
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send email" };
  }
}
