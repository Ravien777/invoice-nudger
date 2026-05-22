import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier, getMonthlyNotificationUsage } from "@/lib/subscriptions";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      plan: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getTier(user.plan);
  const smsUsage = await getMonthlyNotificationUsage(user.id, "sms");
  const whatsappUsage = await getMonthlyNotificationUsage(user.id, "whatsapp");

  return NextResponse.json({
    plan: user.plan,
    sms: {
      enabled: tier.smsLimit > 0,
      limit: tier.smsLimit,
      used: smsUsage,
    },
    whatsapp: {
      enabled: tier.whatsappLimit > 0,
      limit: tier.whatsappLimit,
      used: whatsappUsage,
    },
  });
}
