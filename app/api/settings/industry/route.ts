import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_INDUSTRIES = [
  "freelance_design",
  "software_dev",
  "consulting",
  "marketing_agency",
  "other",
];

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
  const { industry, benchmarksOptOut } = body;

  const data: Record<string, unknown> = {};

  if (industry !== undefined) {
    if (industry !== null && !VALID_INDUSTRIES.includes(industry)) {
      return NextResponse.json({ error: "Invalid industry value" }, { status: 400 });
    }
    data.industry = industry || null;
  }

  if (typeof benchmarksOptOut === "boolean") {
    data.benchmarksOptOut = benchmarksOptOut;
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({ success: true });
}
