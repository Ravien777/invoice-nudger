import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
const ALERT_PREF_KEYS = [
  "highRiskInvoices",
  "clientDeterioration",
  "cashFlowGap",
  "weeklyDigest",
  "cashFlowThreshold",
] as const;

export async function PUT(request: Request) {
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

  const body = await request.json();
  const currentPrefs: Record<string, unknown> = (user.alertPreferences as Record<string, unknown>) || {};

  for (const key of ALERT_PREF_KEYS) {
    if (body[key] !== undefined) {
      currentPrefs[key] = body[key];
    }
  }

  const jsonPrefs = JSON.parse(JSON.stringify(currentPrefs));

  await prisma.user.update({
    where: { id: user.id },
    data: { alertPreferences: jsonPrefs },
  });

  return NextResponse.json({ success: true, preferences: currentPrefs });
}
