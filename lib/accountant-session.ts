import { prisma } from "./prisma";

export async function getOwnerIdForAccountant(
  sessionEmail: string,
): Promise<string | null> {
  const access = await prisma.accountantAccess.findFirst({
    where: {
      accountantEmail: sessionEmail,
      status: "active",
    },
    select: { ownerId: true },
  });

  return access?.ownerId ?? null;
}

export async function requireReadOnlyCheck(
  sessionEmail: string,
): Promise<{ isAccountant: boolean; ownerId: string | null }> {
  const ownerId = await getOwnerIdForAccountant(sessionEmail);
  return { isAccountant: ownerId !== null, ownerId };
}
