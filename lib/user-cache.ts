import { prisma } from "./prisma";
import { cache } from "react";

export const getCachedUser = cache(async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    include: { businessProfile: true },
  });
});
