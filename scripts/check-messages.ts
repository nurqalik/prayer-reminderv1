import { PrismaClient } from '../../prayer-reminder-backend/generated/prisma';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  
  const sessions = await prisma.chatSession.findMany({
    include: { messages: true },
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  console.dir(sessions, { depth: null });
}
main().catch(console.error);
