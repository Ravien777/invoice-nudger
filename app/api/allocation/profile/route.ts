import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  taxPercent: z.coerce.number().min(0).max(100),
  operatingPercent: z.coerce.number().min(0).max(100),
  profitPercent: z.coerce.number().min(0).max(100),
  ownerPayPercent: z.coerce.number().min(0).max(100),
}).refine(
  (data) => data.taxPercent + data.operatingPercent + data.profitPercent + data.ownerPayPercent === 100,
  { message: "Percentages must add up to 100" },
);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const profile = await prisma.allocationProfile.findUnique({
    where: { userId: user.id },
  });

  return Response.json(profile ?? {
    taxPercent: 25,
    operatingPercent: 30,
    profitPercent: 5,
    ownerPayPercent: 40,
    currency: "USD",
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const parsed = profileSchema.safeParse(body);

  if (!parsed.success) {
    const errors = parsed.error.flatten();
    return Response.json({ error: errors.fieldErrors }, { status: 400 });
  }

  const { taxPercent, operatingPercent, profitPercent, ownerPayPercent } = parsed.data;

  const profile = await prisma.allocationProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      taxPercent,
      operatingPercent,
      profitPercent,
      ownerPayPercent,
    },
    update: {
      taxPercent,
      operatingPercent,
      profitPercent,
      ownerPayPercent,
    },
  });

  return Response.json(profile);
}
