import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";
import { getTier } from "@/lib/tiers";

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

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      label: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

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

  const tier = getTier(user.plan);

  if (tier.apiKeysLimit === 0) {
    return NextResponse.json({ error: "API access not available on your plan" }, { status: 403 });
  }

  const currentCount = await prisma.apiKey.count({
    where: { userId: user.id, status: "active" },
  });

  if (currentCount >= tier.apiKeysLimit) {
    return NextResponse.json(
      { error: `Maximum of ${tier.apiKeysLimit} active API keys reached` },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { label, scopes } = body;

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const rawKey = `sk_live_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      label,
      keyPrefix,
      keyHash,
      scopes: scopes ?? "read",
    },
  });

  return NextResponse.json({
    key: rawKey,
    keyPrefix,
    label,
    scopes: scopes ?? "read",
    message: "Save this key — it will not be shown again",
  });
}
