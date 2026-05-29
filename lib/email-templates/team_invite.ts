const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export function teamInviteEmail({
  ownerName,
  ownerEmail,
  role,
  inviteUrl,
}: {
  ownerName: string;
  ownerEmail: string;
  role: string;
  inviteUrl: string;
}) {
  const roleDescription =
    role === "member"
      ? "create and edit invoices, expenses, and time entries"
      : "view invoices, expenses, and reports (read-only)";

  return {
    subject: `${ownerName} has invited you to join their team on Maroni`,
    html: `
      <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
        <p>Hi there,</p>
        <p><strong>${ownerName}</strong> (${ownerEmail}) has invited you to join their team on Maroni.</p>
        <p>As a <strong>${role}</strong>, you'll be able to ${roleDescription}.</p>
        <p style="margin-top: 24px;">
          <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Accept Invitation</a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">If you don't have a Maroni account yet, you'll be prompted to create one after accepting.</p>
      </div>
    `,
  };
}
