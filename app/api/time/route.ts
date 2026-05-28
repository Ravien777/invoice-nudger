import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const startTimerSchema = z.object({
  clientEmail: z.string().email(),
  clientName: z.string().optional(),
  description: z.string().optional(),
  hourlyRate: z.number().positive().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { businessProfile: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const clientEmail = searchParams.get("clientEmail");
  const invoiced = searchParams.get("invoiced");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;

  const where: Record<string, unknown> = { userId: user.id };
  if (clientEmail) where.clientEmail = clientEmail;
  if (invoiced === "true") where.invoiced = true;
  if (invoiced === "false") where.invoiced = false;

  const [entries, total] = await Promise.all([
    prisma.timeEntry.findMany({
      where: where as any,
      orderBy: { startTime: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.timeEntry.count({ where: where as any }),
  ]);

  const formatted = entries.map((e) => ({
    ...e,
    durationLabel: formatDuration(e.durationMinutes),
  }));

  const defaultHourlyRate = user.businessProfile?.defaultHourlyRate ?? null;

  return NextResponse.json({ entries: formatted, total, page, defaultHourlyRate });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const parsed = startTimerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const entry = await prisma.timeEntry.create({
    data: {
      ...parsed.data,
      startTime: new Date(),
      userId: user.id,
    },
  });

  return NextResponse.json({ entry }, { status: 201 });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
