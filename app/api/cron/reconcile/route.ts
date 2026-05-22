import { NextResponse } from "next/server";
import { reconcileAll } from "@/lib/reconciliation";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await reconcileAll();

  const reconciled = results.filter((r) => r.status === "reconciled").length;
  const discrepancies = results.filter((r) => r.status === "discrepancy").length;
  const unreconciled = results.filter((r) => r.status === "unreconciled").length;

  return NextResponse.json({
    date: new Date().toISOString(),
    summary: {
      processed: results.length,
      reconciled,
      discrepancies,
      unreconciled,
    },
    results,
  });
}
