import { prisma } from "./prisma";

const DEFAULT_CATEGORIES = [
  "Software & Subscriptions",
  "Office Supplies",
  "Travel & Transport",
  "Marketing & Advertising",
  "Professional Services",
  "Equipment",
  "Meals & Entertainment",
  "Utilities",
  "Other",
];

export async function seedDefaultExpenseCategories(userId: string) {
  const existing = await prisma.expenseCategory.count({
    where: { userId },
  });

  if (existing > 0) return;

  await Promise.all(
    DEFAULT_CATEGORIES.map((name) =>
      prisma.expenseCategory.create({
        data: { userId, name, isDefault: true },
      }),
    ),
  );
}
