import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";
import { generateWebhookSecret } from "@/lib/webhook-dispatcher";

const VALID_EVENTS = [
  "invoice.created",
  "invoice.updated",
  "invoice.deleted",
  "invoice.paid",
  "invoice.overdue",
  "payment.received",
  "expense.created",
  "client.created",
  "client.updated",
] as const;

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

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      status: true,
      lastDeliveredAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ endpoints });
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

  if (tier.webhookEndpointsLimit === 0) {
    return NextResponse.json({ error: "Webhooks not available on your plan" }, { status: 403 });
  }

  const currentCount = await prisma.webhookEndpoint.count({
    where: { userId: user.id, status: "active" },
  });

  if (currentCount >= tier.webhookEndpointsLimit) {
    return NextResponse.json(
      { error: `Maximum of ${tier.webhookEndpointsLimit} webhook endpoints reached` },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { url, events } = body;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  if (!events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "events must be a non-empty array" }, { status: 400 });
  }

  const invalid = events.filter((e: string) => !VALID_EVENTS.includes(e as any));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Invalid events: ${invalid.join(", ")}. Valid events: ${VALID_EVENTS.join(", ")}` },
      { status: 400 },
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Invalid protocol");
    }
  } catch {
    return NextResponse.json({ error: "url must be a valid HTTP or HTTPS URL" }, { status: 400 });
  }

  const secret = generateWebhookSecret();

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      userId: user.id,
      url,
      secret,
      events,
    },
  });

  return NextResponse.json({
    id: endpoint.id,
    url: endpoint.url,
    events: endpoint.events,
    secret: endpoint.secret,
    createdAt: endpoint.createdAt,
    message: "Save the secret — it will not be shown again",
  });
}
