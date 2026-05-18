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
  console.log(`Checking sessions for user: ${userId}`);
  const sessions = await prisma.chatSession.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      _count: {
        select: { messages: true }
      }
    }
  });

  sessions.forEach((s, i) => {
    console.log(`${i}. Session: ${s.id}, Updated: ${s.updatedAt.toISOString()}, Messages: ${s._count.messages}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
