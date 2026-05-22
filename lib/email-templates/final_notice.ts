interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
  accruedFees?: number;
  feeNote?: string;
}

export function finalNotice({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink, accruedFees, feeNote }: TemplateParams) {
  const totalAmount = accruedFees ? amount + accruedFees : amount;
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedTotal = accruedFees ? new Intl.NumberFormat("en-US", { style: "currency", currency }).format(totalAmount) : formattedAmount;
  const formattedDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  const feeSection = accruedFees && accruedFees > 0 ? `
    <p style="margin-top: 16px; color: #dc2626; font-size: 14px;">
      <strong>Total balance due: ${formattedTotal}</strong>
      ${feeNote ? `<br><span style="color: #6b7280; font-size: 12px;">${feeNote}</span>` : ""}
    </p>
    <p style="color: #6b7280; font-size: 11px; font-style: italic; margin-top: 8px;">
      This information is provided for informational purposes only and does not constitute legal advice. Late fees and interest are subject to applicable laws and your contract terms.
    </p>
  ` : "";

  return {
    subject: `Final notice: Invoice${ref} - immediate payment required`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>This is our final notice regarding invoice${ref} for <strong>${formattedAmount}</strong>, which was due on <strong>${formattedDate}</strong>.</p>
        <p>Despite our previous reminders, we have not received payment. Please settle this invoice <strong>immediately</strong> to avoid further escalation.</p>
        ${feeSection}
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #7f1d1d; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Pay Now</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If payment is not received promptly, we reserve the right to pursue all available remedies.</p>
      </div>
    `,
  };
}
