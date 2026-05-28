export function portalInviteEmail({
  businessName,
  clientName,
  portalUrl,
}: {
  businessName: string;
  clientName?: string | null;
  portalUrl: string;
}) {
  const greeting = clientName ? `Hi ${clientName},` : "Hi there,";

  return {
    subject: `${businessName} — Your Client Portal is Ready`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>${greeting}</p>
        <p><strong>${businessName}</strong> has invited you to view your invoices, quotes, and payment history in their client portal.</p>
        <p>Click the button below to access your portal:</p>
        <p style="margin-top: 24px; text-align: center;">
          <a href="${portalUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">View My Portal</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">This link expires in 90 days. If you have any questions, please reply to this email or contact ${businessName} directly.</p>
      </div>
    `,
  };
}
