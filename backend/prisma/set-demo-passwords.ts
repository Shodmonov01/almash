import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();
const DEMO_USERS = ["admin", "aliya", "bobur", "dilnoza"];
const DEMO_PASSWORD = "demo1234";

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const result = await prisma.user.updateMany({
    where: { username: { in: DEMO_USERS }, passwordHash: null },
    data: { passwordHash },
  });
  console.log(`Set demo password for ${result.count} users (${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
