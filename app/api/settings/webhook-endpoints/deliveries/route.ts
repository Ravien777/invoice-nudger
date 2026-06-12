import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const { searchParams } = new URL(request.url);
  const endpointId = searchParams.get("endpointId");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const where: Record<string, unknown> = {
    endpoint: { userId: user.id },
  };

  if (endpointId) {
    where.endpointId = endpointId;
  }

  const deliveries = await (prisma.webhookDelivery.findMany as any)({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      endpoint: { select: { url: true } },
    },
  });

  return NextResponse.json({ deliveries });
}
