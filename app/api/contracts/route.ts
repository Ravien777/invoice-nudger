import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { renderContractTemplate } from "@/lib/contract-templates";

const createContractSchema = z.object({
  templateId: z.string(),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  title: z.string().min(1),
  variables: z.record(z.string(), z.string()),
  quoteId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const contracts = await prisma.contract.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      template: { select: { name: true } },
    },
  });

  return Response.json(contracts);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json();
  const parsed = createContractSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { templateId, clientName, clientEmail, title, variables, quoteId, expiresAt } = parsed.data;

  const template = await prisma.contractTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) {
    return Response.json({ error: "Template not found" }, { status: 404 });
  }

  const renderedBody = renderContractTemplate(template.body, {
    clientName,
    ...variables,
  });

  const contract = await prisma.contract.create({
    data: {
      userId: user.id,
      templateId,
      clientName,
      clientEmail,
      title,
      body: renderedBody,
      quoteId: quoteId ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 86400000),
    },
  });

  return Response.json(contract, { status: 201 });
}
