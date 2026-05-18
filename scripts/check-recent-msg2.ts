import { PrismaClient } from '../../prayer-reminder-backend/generated/prisma';

async function main() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });
  
  const msgs = await prisma.message.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  msgs.forEach(m => {
    console.log(`[${m.role}] Content: '${m.content}'`);
  });
}
main().catch(console.error);
