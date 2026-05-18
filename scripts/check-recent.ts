import { PrismaClient } from '../../prayer-reminder-backend/generated/prisma';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  
  const sessions = await prisma.chatSession.findMany({
    include: { messages: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' },
    take: 1
  });

  sessions.forEach(s => {
    console.log(`Session: ${s.id}`);
    s.messages.forEach(m => {
      console.log(`  [${m.role}] ID: ${m.id} | Content: ${m.content.substring(0, 30)}`);
    });
  });
}
main().catch(console.error);
