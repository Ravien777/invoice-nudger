import { Configuration, PlaidApi, PlaidEnvironments, type Transaction } from "plaid";
import { prisma } from "./prisma";
import { decrypt } from "./integrations/crypto";
import { autoMatchTransaction } from "./bank-matching";

function getPlaidClient(): PlaidApi {
  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENVIRONMENT as keyof typeof PlaidEnvironments] ?? PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
      },
    },
  });
  return new PlaidApi(config);
}

export async function createLinkToken(userId: string): Promise<string> {
  const plaidClient = getPlaidClient();
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "Maroni",
    products: (process.env.PLAID_PRODUCTS ?? "transactions").split(",") as any,
    country_codes: (process.env.PLAID_COUNTRY_CODES ?? "US").split(",") as any,
    language: "en",
  });
  return response.data.link_token;
}

export async function exchangePublicToken(publicToken: string): Promise<{
  accessToken: string;
  itemId: string;
}> {
  const plaidClient = getPlaidClient();
  const response = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  };
}

export async function syncBankTransactions(connectionId: string): Promise<{
  added: number;
  modified: number;
  removed: number;
  errors: string[];
}> {
  const connection = await prisma.bankConnection.findUnique({
    where: { id: connectionId },
  });
  if (!connection) return { added: 0, modified: 0, removed: 0, errors: ["Connection not found"] };

  let accessToken: string;
  try {
    accessToken = decrypt(connection.accessToken);
  } catch {
    return { added: 0, modified: 0, removed: 0, errors: ["Failed to decrypt access token"] };
  }

  const plaidClient = getPlaidClient();
  let cursor = connection.lastSyncAt?.getTime().toString() ?? undefined;
  let hasMore = true;
  const errors: string[] = [];
  let added = 0;
  let modified = 0;
  let removed = 0;

  try {
    while (hasMore) {
      const response = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor,
      });
      const data = response.data;

      for (const tx of data.added) {
        await upsertTransaction(connection.userId, connection.id, tx);
        added++;
      }
      for (const tx of data.modified) {
        await upsertTransaction(connection.userId, connection.id, tx);
        modified++;
      }
      for (const tx of data.removed) {
        if (tx.transaction_id) {
          await prisma.bankTransaction.updateMany({
            where: { connectionId, externalId: tx.transaction_id },
            data: { status: "ignored" },
          });
          removed++;
        }
      }

      cursor = data.next_cursor;
      hasMore = data.has_more;
    }
  } catch (e: any) {
    errors.push(e.message ?? "Sync failed");
    await prisma.bankConnection.update({
      where: { id: connectionId },
      data: { status: "error" },
    });
  }

  await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { lastSyncAt: new Date(), status: "active" },
  });

  await prisma.syncLog.create({
    data: {
      userId: connection.userId,
      platform: "plaid",
      direction: "pull",
      status: errors.length > 0 ? "error" : "success",
      recordsSynced: added + modified,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
      startedAt: connection.lastSyncAt ?? new Date(),
      completedAt: new Date(),
    },
  });

  return { added, modified, removed, errors };
}

async function upsertTransaction(userId: string, connectionId: string, tx: Transaction) {
  const transaction = await prisma.bankTransaction.upsert({
    where: { externalId: tx.transaction_id },
    create: {
      userId,
      connectionId,
      externalId: tx.transaction_id,
      date: new Date(tx.date),
      description: tx.name ?? tx.merchant_name ?? "Unknown",
      amount: tx.amount != null ? -tx.amount : 0,
      currency: tx.iso_currency_code ?? "USD",
      category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
      status: "unmatched",
    },
    update: {
      date: new Date(tx.date),
      description: tx.name ?? tx.merchant_name ?? "Unknown",
      amount: tx.amount != null ? -tx.amount : 0,
      currency: tx.iso_currency_code ?? "USD",
      category: tx.personal_finance_category?.primary ?? tx.category?.[0] ?? null,
    },
  });

  if (transaction.status === "unmatched") {
    await autoMatchTransaction(transaction.id);
  }
}
