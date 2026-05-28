import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncBankTransactions } from "@/lib/bank-client";

export async function POST() {
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
    where: { userId: user.id, status: "active" },
  });

  if (connections.length === 0) {
    return NextResponse.json({ error: "No active bank connections" }, { status: 400 });
  }

  const results = await Promise.allSettled(
    connections.map((c) => syncBankTransactions(c.id)),
  );

  const synced = results.filter((r) => r.status === "fulfilled").length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => r.reason?.message ?? "Unknown error");

  return NextResponse.json({ synced, total: connections.length, errors });
}
