import { prisma } from "./prisma";
import { cache } from "react";

export const getOwnerIdForAccountant = cache(async (
  sessionEmail: string,
): Promise<string | null> => {
  const access = await prisma.accountantAccess.findFirst({
    where: {
      accountantEmail: sessionEmail,
      status: "active",
    },
    select: { ownerId: true },
  });

  return access?.ownerId ?? null;
});


