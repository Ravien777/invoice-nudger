const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export function accountantInviteEmail({
  ownerName,
  ownerEmail,
  inviteUrl,
}: {
  ownerName: string;
  ownerEmail: string;
  inviteUrl: string;
}) {
  return {
    subject: `${ownerName} has invited you to view their Maroni account`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi there,</p>
        <p><strong>${ownerName}</strong> (${ownerEmail}) has invited you to access their Maroni account as an accountant.</p>
        <p>You'll be able to view their invoices, expenses, reports, and tax information in read-only mode.</p>
        <p style="margin-top: 24px;">
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Accept Invitation</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If you don't have a Maroni account yet, you'll be prompted to create one after accepting.</p>
      </div>
    `,
  };
}
