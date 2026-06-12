import { NextResponse } from "next/server";
import { retryFailedDeliveries } from "@/lib/webhook-dispatcher";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retried = await retryFailedDeliveries();

  return NextResponse.json({ retried });
}
