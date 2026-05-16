interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
}

export function overdueNotice({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink }: TemplateParams) {
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  return {
    subject: `Overdue: Invoice${ref} payment needed`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>Our records show that invoice${ref} for <strong>${formattedAmount}</strong> was due on <strong>${formattedDate}</strong> and is now overdue.</p>
        <p>If payment has already been sent, please disregard this notice. Otherwise, we'd appreciate it if you could settle this invoice as soon as possible.</p>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">View Invoice</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">Please let us know if there's any issue with the invoice.</p>
      </div>
    `,
  };
}
