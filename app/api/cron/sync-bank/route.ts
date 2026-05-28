import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBankTransactions } from "@/lib/bank-client";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await prisma.bankConnection.findMany({
    where: { status: "active" },
  });

  let synced = 0;
  const errors: Array<{ connectionId: string; error: string }> = [];

  for (const conn of connections) {
    try {
      const result = await syncBankTransactions(conn.id);
      synced += result.added + result.modified;
      if (result.errors.length > 0) {
        errors.push({ connectionId: conn.id, error: result.errors.join("; ") });
      }
    } catch (e: any) {
      errors.push({ connectionId: conn.id, error: e.message ?? "Unknown error" });
    }
  }

  return NextResponse.json({
    processed: connections.length,
    synced,
    errors: errors.length > 0 ? errors : undefined,
  });
}
