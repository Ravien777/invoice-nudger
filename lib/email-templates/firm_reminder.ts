interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
}

export function firmReminder({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink }: TemplateParams) {
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  return {
    subject: `Urgent: Invoice${ref} remains unpaid`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>We have not yet received payment for invoice${ref} in the amount of <strong>${formattedAmount}</strong>, which was due on <strong>${formattedDate}</strong>.</p>
        <p>This is now significantly overdue. Please arrange payment immediately or contact us to discuss the situation.</p>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #b91c1c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">View Invoice</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If we do not hear from you soon, we may need to take further action.</p>
      </div>
    `,
  };
}
