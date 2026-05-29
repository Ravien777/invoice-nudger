import { prisma } from "@/lib/prisma";
import type { Session } from "next-auth";

export async function getTeamContext(session: Session | null) {
  if (!session?.user?.email) return null;

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return null;

  const tm = await prisma.teamMember.findFirst({
    where: { memberUserId: user.id, status: "active" },
    select: { ownerId: true, role: true },
  });
  if (!tm) return null;

  return { ownerId: tm.ownerId, role: tm.role as "member" | "viewer" };
}

export async function getEffectiveUser(session: Session) {
  const teamCtx = await getTeamContext(session);
  if (teamCtx) {
    return { userId: teamCtx.ownerId, role: teamCtx.role };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user!.email! },
    select: { id: true },
  });

  return { userId: user!.id, role: "owner" as const };
}
