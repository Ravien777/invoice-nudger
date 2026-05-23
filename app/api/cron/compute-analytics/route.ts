import { NextResponse } from "next/server";
import { computeAllAnalytics, recomputePaymentProbabilitiesForAll } from "@/lib/analytics";

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

  try {
    await computeAllAnalytics();
    await recomputePaymentProbabilitiesForAll();

    return NextResponse.json({
      success: true,
      message: "Analytics and payment probabilities computed for all users",
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics cron failed:", error);
    return NextResponse.json(
      { error: "Analytics computation failed" },
      { status: 500 }
    );
  }
}
