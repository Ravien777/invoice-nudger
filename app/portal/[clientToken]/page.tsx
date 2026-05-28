import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { validatePortalToken, getClientInvoices } from "@/lib/portal";
import PortalClient from "./PortalClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clientToken: string }>;
}): Promise<Metadata> {
  const { clientToken } = await params;
  const validated = await validatePortalToken(clientToken);

  if (!validated) {
    return {
      title: "Portal Unavailable",
      robots: { index: false, follow: false },
    };
  }

  const title = validated.branding.businessName
    ? `${validated.branding.businessName} — Client Portal`
    : "Client Portal";

  return {
    title,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function PortalPage({
  params,
}: {
  params: Promise<{ clientToken: string }>;
}) {
  const { clientToken } = await params;

  const validated = await validatePortalToken(clientToken);

  if (!validated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger-muted)]">
            <svg
              className="h-8 w-8 text-[var(--danger)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h1 className="mb-2 text-xl font-bold text-foreground">Portal Unavailable</h1>
          <p className="text-muted">
            This portal link has expired or is no longer valid. Please contact the sender for a new link.
          </p>
        </div>
      </main>
    );
  }

  const [invoices, quotes] = await Promise.all([
    getClientInvoices(validated.userId, validated.clientEmail),
    prisma.quote.findMany({
      where: { userId: validated.userId, clientEmail: validated.clientEmail },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <PortalClient
      invoices={invoices.map((inv) => ({
        ...inv,
        dueDate: inv.dueDate.toISOString(),
        paidAt: inv.paidAt?.toISOString() ?? null,
        createdAt: inv.createdAt.toISOString(),
      }))}
      quotes={quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        clientName: q.clientName,
        amount: q.amount,
        currency: q.currency,
        status: q.status,
        issueDate: q.issueDate.toISOString(),
        expiryDate: q.expiryDate?.toISOString() ?? null,
      }))}
      branding={validated.branding}
      clientName={validated.clientName}
    />
  );
}
