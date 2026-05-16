import { prisma } from "./prisma";

const DEFAULT_SCHEDULE_STEPS = [
  { daysOffset: -3, emailTemplate: "gentle_reminder" },
  { daysOffset: 0, emailTemplate: "due_today" },
  { daysOffset: 3, emailTemplate: "overdue_notice" },
  { daysOffset: 7, emailTemplate: "firm_reminder" },
  { daysOffset: 14, emailTemplate: "final_notice" },
];

export async function seedDefaultSchedule(userId: string) {
  const existing = await prisma.reminderSchedule.findFirst({
    where: { userId, isDefault: true },
  });

  if (existing) return existing;

  return prisma.reminderSchedule.create({
    data: {
      name: "Standard",
      isDefault: true,
      userId,
      steps: {
        create: DEFAULT_SCHEDULE_STEPS,
      },
    },
    include: { steps: true },
  });
}
