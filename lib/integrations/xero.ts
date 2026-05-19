import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "./crypto";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_URL = "https://api.xero.com/api.xro/2.0";
const XERO_SCOPES = "accounting.transactions accounting.contacts offline_access";

export function getXeroAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID || "",
    redirect_uri: process.env.XERO_REDIRECT_URI || "",
    scope: XERO_SCOPES,
    state,
  });
  return `${XERO_AUTH_URL}?${params.toString()}`;
}

interface XeroTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export async function exchangeXeroCode(code: string): Promise<XeroTokenResponse> {
  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI || "",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Xero token exchange failed: ${error}`);
  }

  return response.json();
}

export async function refreshXeroToken(refreshToken: string): Promise<XeroTokenResponse> {
  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Xero token refresh failed: ${error}`);
  }

  return response.json();
}

interface XeroTenant {
  id: string;
  name: string;
}

export async function getXeroTenants(accessToken: string): Promise<XeroTenant[]> {
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Xero connections");
  }

  return response.json();
}

interface XeroContact {
  ContactID: string;
  Name: string;
  EmailAddress?: string;
}

interface XeroInvoice {
  InvoiceID: string;
  InvoiceNumber: string;
  Contact: XeroContact;
  AmountDue: number;
  Total: number;
  Date: string;
  DueDate: string;
  Status: string;
  CurrencyCode: string;
}

interface XeroInvoicesResponse {
  Invoices: XeroInvoice[];
}

export async function pullXeroInvoices(
  accessToken: string,
  tenantId: string
): Promise<XeroInvoice[]> {
  const params = new URLSearchParams({
    where: 'Status=="AUTHD" OR Status=="SUBMITTED"',
    order: "DueDate ASC",
  });

  const response = await fetch(
    `${XERO_API_URL}/Invoices?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "xero-tenant-id": tenantId,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Xero invoices");
  }

  const data: XeroInvoicesResponse = await response.json();
  return data.Invoices || [];
}

export async function pushXeroPayment(
  accessToken: string,
  tenantId: string,
  invoiceId: string,
  amount: number,
  date: string
): Promise<boolean> {
  const body = JSON.stringify({
    Amount: amount,
    InvoiceID: invoiceId,
    Date: date,
  });

  const response = await fetch(`${XERO_API_URL}/Payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      "Content-Type": "application/json",
    },
    body,
  });

  return response.ok;
}

export async function ensureXeroToken(connectionId: string): Promise<{
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

  const tokenResponse = await refreshXeroToken(decrypt(connection.refreshToken));
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
