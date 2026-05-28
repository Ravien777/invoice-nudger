import { prisma } from "@/lib/prisma";
import { SYSTEM_TEMPLATES } from "@/lib/contract-templates";

export async function POST() {
  let created = 0;
  for (const tmpl of SYSTEM_TEMPLATES) {
    const existing = await prisma.contractTemplate.findFirst({
      where: { userId: null, name: tmpl.name },
    });
    if (!existing) {
      await prisma.contractTemplate.create({
        data: { name: tmpl.name, body: tmpl.body, isDefault: true },
      });
      created++;
    }
  }
  return Response.json({ created, total: SYSTEM_TEMPLATES.length });
}
