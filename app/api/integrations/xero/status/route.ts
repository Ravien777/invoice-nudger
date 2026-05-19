import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  const connection = await prisma.integrationConnection.findUnique({
    where: { userId_platform: { userId: user.id, platform: "xero" } },
  });

  const lastSync = await prisma.syncLog.findFirst({
    where: { userId: user.id, platform: "xero" },
    orderBy: { startedAt: "desc" },
  });

  return Response.json({
    connected: !!connection,
    tenantId: connection?.tenantId,
    connectedAt: connection?.connectedAt,
    expiresAt: connection?.expiresAt,
    lastSync: lastSync
      ? {
          status: lastSync.status,
          direction: lastSync.direction,
          recordsSynced: lastSync.recordsSynced,
          startedAt: lastSync.startedAt,
          errorMessage: lastSync.errorMessage,
        }
      : null,
  });
}
