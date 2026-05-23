import { NextResponse } from "next/server";
import { generatePredictiveAlertsForAll } from "@/lib/alerts";

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
    const alertsCreated = await generatePredictiveAlertsForAll();

    return NextResponse.json({
      success: true,
      alertsCreated,
      message: `Generated ${alertsCreated} predictive alerts`,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Alert generation cron failed:", error);
    return NextResponse.json(
      { error: "Alert generation failed" },
      { status: 500 }
    );
  }
}
