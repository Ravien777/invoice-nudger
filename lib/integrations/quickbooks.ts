import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "./crypto";

const QUICKBOOKS_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QUICKBOOKS_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QUICKBOOKS_API_URL = "https://quickbooks.api.intuit.com/v3/company";
const QUICKBOOKS_SCOPES = "com.intuit.quickbooks.accounting";

export function getQuickBooksAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.QUICKBOOKS_CLIENT_ID || "",
    redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI || "",
    scope: QUICKBOOKS_SCOPES,
    state,
  });
  return `${QUICKBOOKS_AUTH_URL}?${params.toString()}`;
}

interface QuickBooksTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  x_refresh_token_expires_in: number;
}

export async function exchangeQuickBooksCode(code: string): Promise<QuickBooksTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI || "",
  });

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64")}`,
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`QuickBooks token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshQuickBooksToken(refreshToken: string): Promise<QuickBooksTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64")}`,
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`QuickBooks token refresh failed: ${error}`);
  }

  return response.json();
}

interface QuickBooksCustomer {
  Id: string;
  DisplayName: string;
  PrimaryEmailAddr?: { Address: string };
}

interface QuickBooksInvoice {
  Id: string;
  DocNumber?: string;
  CustomerRef: { value: string };
  TotalAmt: number;
  Balance: number;
  TxnDate: string;
  DueDate: string;
  domain: string;
  sparse: boolean;
  Line: Array<{
    Amount: number;
    DetailType: string;
    SalesItemLineDetail?: {
      ItemRef: { value: string; name: string };
      UnitPrice: number;
      Qty: number;
    };
  }>;
  CustomerMemo?: { value: string };
}

interface QuickBooksInvoiceQueryResponse {
  QueryResponse: {
    Invoice: QuickBooksInvoice[];
    startPosition: number;
    maxResults: number;
  };
}

interface QuickBooksCustomerQueryResponse {
  QueryResponse: {
    Customer: QuickBooksCustomer[];
    startPosition: number;
    maxResults: number;
  };
}

export async function pullQuickBooksInvoices(
  accessToken: string,
  realmId: string
): Promise<QuickBooksInvoice[]> {
  const query = encodeURIComponent(
    "SELECT * FROM Invoice WHERE Balance > 0 AND TxnDate > '2020-01-01' ORDER BY DueDate ASC MAXRESULTS 1000"
  );

  const response = await fetch(
    `${QUICKBOOKS_API_URL}/${realmId}/query?query=${query}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch QuickBooks invoices");
  }

  const data: QuickBooksInvoiceQueryResponse = await response.json();
  return data.QueryResponse?.Invoice || [];
}

export async function pullQuickBooksCustomers(
  accessToken: string,
  realmId: string
): Promise<QuickBooksCustomer[]> {
  const query = encodeURIComponent(
    "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000"
  );

  const response = await fetch(
    `${QUICKBOOKS_API_URL}/${realmId}/query?query=${query}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch QuickBooks customers");
  }

  const data: QuickBooksCustomerQueryResponse = await response.json();
  return data.QueryResponse?.Customer || [];
}

export async function pushQuickBooksPayment(
  accessToken: string,
  realmId: string,
  invoiceId: string,
  amount: number,
  date: string
): Promise<boolean> {
  const body = JSON.stringify({
    TxnDate: date,
    TotalAmt: amount,
    CustomerRef: { value: invoiceId },
    Line: [
      {
        Amount: amount,
        LinkedTxn: [
          {
            TxnId: invoiceId,
            TxnType: "Invoice",
          },
        ],
      },
    ],
  });

  const response = await fetch(`${QUICKBOOKS_API_URL}/${realmId}/payment`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });

  return response.ok;
}

export async function ensureQuickBooksToken(connectionId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const connection = await prisma.integrationConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw new Error("Integration connection not found");
  }

  const now = new Date();
  if (connection.expiresAt > now) {
    return {
      accessToken: decrypt(connection.accessToken),
      refreshToken: decrypt(connection.refreshToken),
      expiresAt: connection.expiresAt,
    };
  }

  const tokenResponse = await refreshQuickBooksToken(decrypt(connection.refreshToken));
  const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

  await prisma.integrationConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: encrypt(tokenResponse.access_token),
      refreshToken: encrypt(tokenResponse.refresh_token),
      expiresAt: newExpiresAt,
    },
  });

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: newExpiresAt,
  };
}
