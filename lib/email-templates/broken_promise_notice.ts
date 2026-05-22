interface TemplateParams {
  clientName: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  dueDate: Date;
  paymentLink: string;
  promisedDate: Date;
}

export function brokenPromiseNotice({ clientName, invoiceNumber, amount, currency, dueDate, paymentLink, promisedDate }: TemplateParams) {
  const formattedAmount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  const formattedDueDate = dueDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const formattedPromisedDate = promisedDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ref = invoiceNumber ? ` #${invoiceNumber}` : "";

  return {
    subject: `Payment overdue — Invoice${ref} remains unpaid`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi ${clientName},</p>
        <p>On a previous communication, you indicated that payment for invoice${ref} in the amount of <strong>${formattedAmount}</strong> would be made by <strong>${formattedPromisedDate}</strong>.</p>
        <p>The original due date was <strong>${formattedDueDate}</strong>. We have not yet received payment, and the promised date has now passed.</p>
        <p>Please arrange payment as soon as possible or contact us immediately if there is an issue preventing payment.</p>
        <p style="margin-top: 24px;">
          <a href="${paymentLink}" style="display: inline-block; padding: 12px 24px; background: #b91c1c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Pay Now</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If we do not receive payment or hear from you shortly, we may need to escalate this matter further.</p>
      </div>
    `,
  };
}
