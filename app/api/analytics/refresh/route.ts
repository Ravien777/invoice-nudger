import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeAllAnalyticsForUser } from "@/lib/analytics";

export async function POST(request: Request) {
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

  try {
    await computeAllAnalyticsForUser(user.id);

    const summary = await prisma.invoiceDailySummary.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 30,
    });

    const clientProfiles = await prisma.clientPaymentProfile.findMany({
      where: { userId: user.id },
      orderBy: { riskScore: "desc" },
    });

    return NextResponse.json({
      success: true,
      summary,
      clientProfiles,
    });
  } catch (error) {
    console.error("Analytics refresh failed:", error);
    return NextResponse.json(
      { error: "Failed to refresh analytics" },
      { status: 500 }
    );
  }
}
