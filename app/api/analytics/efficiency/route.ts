import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeCollectionEfficiencyForUser } from "@/lib/analytics";

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

  try {
    const metrics = await computeCollectionEfficiencyForUser(user.id);
    return NextResponse.json(metrics, {
      headers: { "Cache-Control": "private, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("Efficiency computation failed:", error);
    return NextResponse.json(
      { error: "Failed to compute efficiency metrics" },
      { status: 500 }
    );
  }
}
