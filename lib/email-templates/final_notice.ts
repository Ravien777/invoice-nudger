interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
}

export function finalNotice({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink }: TemplateParams) {
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  return {
    subject: `Final notice: Invoice${ref} - immediate payment required`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>This is our final notice regarding invoice${ref} for <strong>${formattedAmount}</strong>, which was due on <strong>${formattedDate}</strong>.</p>
        <p>Despite our previous reminders, we have not received payment. Please settle this invoice <strong>immediately</strong> to avoid further escalation.</p>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #7f1d1d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">View Invoice</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If payment is not received promptly, we reserve the right to pursue all available remedies.</p>
      </div>
    `,
  };
}
