import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";
import { computeForecast } from "@/lib/forecast";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getTier(user.plan);
  const hasAccess = tier.features.includes("cash_flow_forecast");

  if (!hasAccess) {
    return NextResponse.json(
      { error: "Upgrade to Pro or Agency to access cash flow forecasting." },
      { status: 402 }
    );
  }

  const { searchParams } = new URL(request.url);
  const horizonParam = searchParams.get("horizon");
  const horizon = horizonParam ? Math.min(Math.max(parseInt(horizonParam, 10) || 90, 1), 90) : 90;

  const forecast = await computeForecast(user.id, horizon);

  return NextResponse.json(forecast, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600",
    },
  });
}
