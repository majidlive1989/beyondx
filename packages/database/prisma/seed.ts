import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "./seed-runner.js";

const prisma = new PrismaClient();

seedDatabase(prisma)
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
