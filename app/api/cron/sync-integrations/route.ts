import { prisma } from "@/lib/prisma";
import { syncXero, syncQuickBooks } from "@/lib/integrations/sync";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const connections = await prisma.integrationConnection.findMany({
    select: { userId: true, platform: true },
  });

  const userIds = [...new Set(connections.map((c) => c.userId))];
  const results: Record<string, Record<string, { pulled: number; pushed: number; errors: string[] }>> = {};

  for (const userId of userIds) {
    results[userId] = {};

    const hasXero = connections.some((c) => c.userId === userId && c.platform === "xero");
    const hasQuickBooks = connections.some((c) => c.userId === userId && c.platform === "quickbooks");

    if (hasXero) {
      results[userId].xero = await syncXero(userId);
    }

    if (hasQuickBooks) {
      results[userId].quickbooks = await syncQuickBooks(userId);
    }
  }

  return Response.json({
    date: new Date().toISOString(),
    summary: {
      usersSynced: userIds.length,
      totalConnections: connections.length,
    },
    results,
  });
}
