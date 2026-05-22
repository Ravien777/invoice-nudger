interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
}

export function gentleReminder({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink }: TemplateParams) {
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  return {
    subject: `Friendly reminder: Invoice${ref} is due soon`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>This is just a friendly reminder that invoice${ref} for <strong>${formattedAmount}</strong> is due on <strong>${formattedDate}</strong>.</p>
        <p>If you've already sent the payment, thank you! You can disregard this email.</p>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Pay Now</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If you have any questions, feel free to reach out.</p>
      </div>
    `,
  };
}
