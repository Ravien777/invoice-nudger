import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  const connections = await prisma.bankConnection.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const serialized = connections.map((c) => ({
    id: c.id,
    provider: c.provider,
    institutionName: c.institutionName,
    accountMask: c.accountMask,
    status: c.status,
    lastSyncAt: c.lastSyncAt?.toISOString() ?? null,
  }));

  return NextResponse.json(serialized);
}
