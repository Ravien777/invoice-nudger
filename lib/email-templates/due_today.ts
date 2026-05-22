interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
}

export function dueToday({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink }: TemplateParams) {
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  return {
    subject: `Invoice${ref} is due today`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>This is a quick note to let you know that invoice${ref} for <strong>${formattedAmount}</strong> is due <strong>today</strong> (${formattedDate}).</p>
        <p>Please arrange payment at your earliest convenience.</p>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #d97706; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Pay Now</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Thank you for your prompt attention to this matter.</p>
      </div>
    `,
  };
}
