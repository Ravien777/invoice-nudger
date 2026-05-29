import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SYSTEM_TEMPLATES } from "@/lib/contract-templates";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.contractTemplate.findMany({
    where: { userId: null },
    select: { id: true, name: true, body: true },
  });

  if (existing.length === 0) {
    await prisma.contractTemplate.createMany({
      data: SYSTEM_TEMPLATES.map((t) => ({
        name: t.name,
        body: t.body,
        isDefault: true,
        userId: null,
      })),
    });

    const seeded = await prisma.contractTemplate.findMany({
      where: { userId: null },
      select: { id: true, name: true, body: true },
    });

    return NextResponse.json({ templates: seeded });
  }

  return NextResponse.json({ templates: existing });
}
