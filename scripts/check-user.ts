import { PrismaClient } from '../../prayer-reminder-backend/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const userId = "70c40314edeea647";
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  console.log(`User: ${userId}`);
  console.log(`Name: ${user?.name}`);
  console.log(`Email: ${user?.email}`);
  console.log(`Gemini API Key: ${user?.geminiApiKey ? 'Set (starts with ' + user.geminiApiKey.substring(0, 5) + '...)' : 'Not Set'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
