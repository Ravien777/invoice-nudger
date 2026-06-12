import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateApiKey } from "@/lib/plazaos-auth";
import { sendWebhook } from "@/lib/plazaos-webhook";

const clientSchema = z.object({
  plazaos_client_id: z.number().int().positive(),
  company_name: z.string().min(1),
  contact_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  status: z.string().optional().default("active"),
});

const webhookSchema = z.object({
  event: z.enum(["client.created", "client.updated"]),
  client: clientSchema,
});

export async function POST(request: Request) {
  const authError = validateApiKey(request);
  if (authError) return authError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const validation = webhookSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { event, client } = validation.data;

  const data = {
    plazaosClientId: client.plazaos_client_id,
    companyName: client.company_name,
    contactName: client.contact_name,
    email: client.email,
    phone: client.phone ?? null,
    website: client.website ?? null,
    industry: client.industry ?? null,
    city: client.city ?? null,
    country: client.country ?? null,
    status: client.status,
  };

  if (event === "client.created") {
    const created = await prisma.plazaosClient.create({ data });
    return NextResponse.json({ client_id: created.id }, { status: 201 });
  }

  const existing = await prisma.plazaosClient.findUnique({
    where: { plazaosClientId: data.plazaosClientId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Client not found for update" },
      { status: 404 }
    );
  }

  const updated = await prisma.plazaosClient.update({
    where: { plazaosClientId: data.plazaosClientId },
    data,
  });

  sendWebhook("client.updated", { client_id: updated.id });

  return NextResponse.json({ client_id: updated.id });
}
