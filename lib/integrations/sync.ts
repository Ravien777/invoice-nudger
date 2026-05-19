import { prisma } from "@/lib/prisma";
import {
  pullXeroInvoices,
  pushXeroPayment,
  ensureXeroToken,
} from "./xero";
import {
  pullQuickBooksInvoices,
  pushQuickBooksPayment,
  ensureQuickBooksToken,
} from "./quickbooks";

interface SyncResult {
  pulled: number;
  pushed: number;
  errors: string[];
}

async function createSyncLog(
  userId: string,
  platform: string,
  direction: string,
  status: string,
  recordsSynced: number,
  errorMessage?: string
) {
  return prisma.syncLog.create({
    data: {
      userId,
      platform,
      direction,
      status,
      recordsSynced,
      errorMessage,
      completedAt: new Date(),
    },
  });
}

export async function syncXero(userId: string): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, errors: [] };

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_platform: { userId, platform: "xero" } },
  });

  if (!connection) {
    result.errors.push("No Xero connection found");
    return result;
  }

  try {
    const { accessToken } = await ensureXeroToken(connection.id);
    const tenantId = connection.tenantId;
    if (!tenantId) {
      result.errors.push("No tenant ID for Xero connection");
      return result;
    }

    const xeroInvoices = await pullXeroInvoices(accessToken, tenantId);
    const pullStartedAt = new Date();
    let pullCount = 0;

    for (const xeroInvoice of xeroInvoices) {
      try {
        const existing = await prisma.invoice.findFirst({
          where: {
            userId,
            externalId: xeroInvoice.InvoiceID,
            source: "xero",
          },
        });

        const contactEmail = xeroInvoice.Contact.EmailAddress || "";
        const invoiceData = {
          userId,
          source: "xero" as const,
          externalId: xeroInvoice.InvoiceID,
          externalContactId: xeroInvoice.Contact.ContactID,
          invoiceNumber: xeroInvoice.InvoiceNumber,
          clientName: xeroInvoice.Contact.Name,
          clientEmail: contactEmail || `xero-contact-${xeroInvoice.Contact.ContactID}@placeholder.local`,
          amount: xeroInvoice.Total,
          currency: xeroInvoice.CurrencyCode,
          dueDate: new Date(xeroInvoice.DueDate),
          status: xeroInvoice.Status === "PAID" ? "paid" : xeroInvoice.Status === "OVERDUE" ? "overdue" : "unpaid",
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await prisma.invoice.update({
            where: { id: existing.id },
            data: {
              amount: invoiceData.amount,
              status: invoiceData.status,
              lastSyncedAt: invoiceData.lastSyncedAt,
            },
          });
        } else {
          await prisma.invoice.create({ data: invoiceData });
        }
        pullCount++;
      } catch (err) {
        result.errors.push(`Failed to sync Xero invoice ${xeroInvoice.InvoiceNumber}: ${(err as Error).message}`);
      }
    }

    result.pulled = pullCount;
    await createSyncLog(userId, "xero", "pull", "success", pullCount);

    const paidInvoices = await prisma.invoice.findMany({
      where: {
        userId,
        source: "xero",
        status: "paid",
        externalId: { not: null },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - 3600000) } }],
      },
    });

    let pushCount = 0;
    for (const invoice of paidInvoices) {
      try {
        const success = await pushXeroPayment(
          accessToken,
          tenantId,
          invoice.externalId!,
          invoice.amount,
          new Date().toISOString().split("T")[0]
        );
        if (success) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { lastSyncedAt: new Date() },
          });
          pushCount++;
        }
      } catch (err) {
        result.errors.push(`Failed to push payment for invoice ${invoice.invoiceNumber}: ${(err as Error).message}`);
      }
    }

    result.pushed = pushCount;
    if (pushCount > 0) {
      await createSyncLog(userId, "xero", "push", "success", pushCount);
    }
  } catch (err) {
    result.errors.push(`Xero sync failed: ${(err as Error).message}`);
    await createSyncLog(userId, "xero", "pull", "error", 0, (err as Error).message);
  }

  return result;
}

export async function syncQuickBooks(userId: string): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, errors: [] };

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_platform: { userId, platform: "quickbooks" } },
  });

  if (!connection) {
    result.errors.push("No QuickBooks connection found");
    return result;
  }

  try {
    const { accessToken } = await ensureQuickBooksToken(connection.id);
    const realmId = connection.tenantId;
    if (!realmId) {
      result.errors.push("No realm ID for QuickBooks connection");
      return result;
    }

    const qbInvoices = await pullQuickBooksInvoices(accessToken, realmId);
    let pullCount = 0;

    for (const qbInvoice of qbInvoices) {
      try {
        const existing = await prisma.invoice.findFirst({
          where: {
            userId,
            externalId: qbInvoice.Id,
            source: "quickbooks",
          },
        });

        const invoiceData = {
          userId,
          source: "quickbooks" as const,
          externalId: qbInvoice.Id,
          externalContactId: qbInvoice.CustomerRef.value,
          invoiceNumber: qbInvoice.DocNumber || qbInvoice.Id,
          clientName: `QuickBooks Customer ${qbInvoice.CustomerRef.value}`,
          clientEmail: `qb-customer-${qbInvoice.CustomerRef.value}@placeholder.local`,
          amount: qbInvoice.TotalAmt,
          currency: "USD",
          dueDate: new Date(qbInvoice.DueDate),
          status: qbInvoice.Balance === 0 ? "paid" : qbInvoice.Balance < qbInvoice.TotalAmt ? "unpaid" : "unpaid",
          lastSyncedAt: new Date(),
        };

        if (existing) {
          await prisma.invoice.update({
            where: { id: existing.id },
            data: {
              amount: invoiceData.amount,
              status: invoiceData.status,
              lastSyncedAt: invoiceData.lastSyncedAt,
            },
          });
        } else {
          await prisma.invoice.create({ data: invoiceData });
        }
        pullCount++;
      } catch (err) {
        result.errors.push(`Failed to sync QuickBooks invoice ${qbInvoice.Id}: ${(err as Error).message}`);
      }
    }

    result.pulled = pullCount;
    await createSyncLog(userId, "quickbooks", "pull", "success", pullCount);

    const paidInvoices = await prisma.invoice.findMany({
      where: {
        userId,
        source: "quickbooks",
        status: "paid",
        externalId: { not: null },
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: new Date(Date.now() - 3600000) } }],
      },
    });

    let pushCount = 0;
    for (const invoice of paidInvoices) {
      try {
        const success = await pushQuickBooksPayment(
          accessToken,
          realmId,
          invoice.externalId!,
          invoice.amount,
          new Date().toISOString().split("T")[0]
        );
        if (success) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { lastSyncedAt: new Date() },
          });
          pushCount++;
        }
      } catch (err) {
        result.errors.push(`Failed to push payment for invoice ${invoice.invoiceNumber}: ${(err as Error).message}`);
      }
    }

    result.pushed = pushCount;
    if (pushCount > 0) {
      await createSyncLog(userId, "quickbooks", "push", "success", pushCount);
    }
  } catch (err) {
    result.errors.push(`QuickBooks sync failed: ${(err as Error).message}`);
    await createSyncLog(userId, "quickbooks", "pull", "error", 0, (err as Error).message);
  }

  return result;
}
