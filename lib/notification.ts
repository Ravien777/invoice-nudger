import { Twilio } from "twilio";
import { prisma } from "./prisma";
import { getSMSTemplate } from "./sms-templates";

const twilioAccountSid = () => process.env.TWILIO_ACCOUNT_SID ?? "";
const twilioAuthToken = () => process.env.TWILIO_AUTH_TOKEN ?? "";
const twilioPhoneNumber = () => process.env.TWILIO_PHONE_NUMBER ?? "";
const twilioWhatsAppNumber = () => process.env.TWILIO_WHATSAPP_NUMBER ?? "";

function getClient(): Twilio | null {
  const sid = twilioAccountSid();
  const token = twilioAuthToken();
  if (!sid || !token) return null;
  return new Twilio(sid, token);
}

interface InvoiceWithDetails {
  id: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string;
  amount: number;
  currency: string;
  dueDate: Date;
  invoiceNumber: string | null;
  paymentLink: string | null;
}

interface ReminderStep {
  emailTemplate: string;
}

interface SendOptions {
  promiseEventId?: string;
}

export async function sendSMS(
  invoice: InvoiceWithDetails,
  step: ReminderStep,
  options?: SendOptions
): Promise<{ success: boolean; error?: string }> {
  if (!invoice.clientPhone) {
    return { success: false, error: "No phone number on invoice" };
  }

  const optOut = await prisma.sMSOptOut.findUnique({
    where: { phone_channel: { phone: invoice.clientPhone, channel: "sms" } },
  });
  if (optOut) {
    return { success: false, error: "Phone number has opted out of SMS" };
  }

  const templateFn = getSMSTemplate(step.emailTemplate);
  if (!templateFn) {
    return { success: false, error: `Unknown SMS template: ${step.emailTemplate}` };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

  const content = templateFn({
    clientName: invoice.clientName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paymentLink,
  });

  const client = getClient();
  if (!client) {
    return { success: false, error: "Twilio not configured" };
  }

  const from = twilioPhoneNumber();
  if (!from) {
    return { success: false, error: "TWILIO_PHONE_NUMBER not set" };
  }

  try {
    await client.messages.create({
      body: content.body,
      from,
      to: invoice.clientPhone,
    });

    await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        stepName: step.emailTemplate,
        channel: "sms",
        sentTo: invoice.clientPhone,
        promiseEventId: options?.promiseEventId ?? null,
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send SMS" };
  }
}

export async function sendWhatsApp(
  invoice: InvoiceWithDetails,
  step: ReminderStep,
  options?: SendOptions
): Promise<{ success: boolean; error?: string }> {
  if (!invoice.clientPhone) {
    return { success: false, error: "No phone number on invoice" };
  }

  const optOut = await prisma.sMSOptOut.findUnique({
    where: { phone_channel: { phone: invoice.clientPhone, channel: "whatsapp" } },
  });
  if (optOut) {
    return { success: false, error: "Phone number has opted out of WhatsApp" };
  }

  const templateFn = getSMSTemplate(step.emailTemplate);
  if (!templateFn) {
    return { success: false, error: `Unknown SMS template: ${step.emailTemplate}` };
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const paymentLink = invoice.paymentLink || `${baseUrl}/pay/${invoice.id}`;

  const content = templateFn({
    clientName: invoice.clientName,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paymentLink,
  });

  const client = getClient();
  if (!client) {
    return { success: false, error: "Twilio not configured" };
  }

  const from = twilioWhatsAppNumber() || twilioPhoneNumber();
  const whatsappFrom = `whatsapp:${from}`;
  const whatsappTo = `whatsapp:${invoice.clientPhone}`;

  if (!from) {
    return { success: false, error: "Twilio phone number not configured" };
  }

  try {
    await client.messages.create({
      body: content.body,
      from: whatsappFrom,
      to: whatsappTo,
    });

    await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        stepName: step.emailTemplate,
        channel: "whatsapp",
        sentTo: invoice.clientPhone,
        promiseEventId: options?.promiseEventId ?? null,
      },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send WhatsApp" };
  }
}

export async function sendNotification(
  invoice: InvoiceWithDetails,
  step: ReminderStep,
  channel: "email" | "sms" | "whatsapp",
  options?: SendOptions
): Promise<{ success: boolean; error?: string }> {
  switch (channel) {
    case "sms":
      return sendSMS(invoice, step, options);
    case "whatsapp":
      return sendWhatsApp(invoice, step, options);
    default:
      return { success: false, error: `Unsupported channel: ${channel}` };
  }
}
