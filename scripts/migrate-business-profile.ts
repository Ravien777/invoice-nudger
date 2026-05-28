import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Migrating tax/financial fields from User to BusinessProfile...");

  const users = await prisma.user.findMany({
    where: { businessProfile: null },
    select: {
      id: true,
      taxRate: true,
      fiscalYearStart: true,
      taxSavingsAmount: true,
      baseCurrency: true,
    },
  });

  console.log(`Found ${users.length} users without a BusinessProfile.`);

  for (const user of users) {
    await prisma.businessProfile.create({
      data: {
        userId: user.id,
        taxRate: user.taxRate,
        fiscalYearStart: user.fiscalYearStart,
        taxSavingsAmount: user.taxSavingsAmount,
        baseCurrency: user.baseCurrency,
      },
    });
  }

  console.log("Migration complete.");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
