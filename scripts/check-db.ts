import { PrismaClient } from '../../prayer-reminder-backend/generated/prisma';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  console.log("Checking DB...");
  const lastMessages = await prisma.message.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      session: {
        include: {
          user: true
        }
      }
    }
  });

  console.log("\nLast 10 Messages:");
  lastMessages.forEach(m => {
    console.log(`[${m.createdAt.toISOString()}] User: ${m.session.user.id} (${m.session.user.name}), Session: ${m.sessionId}, Role: ${m.role}, Content: ${m.content.substring(0, 30)}`);
  });

  const lastSessions = await prisma.chatSession.findMany({
    take: 5,
    orderBy: { updatedAt: 'desc' },
    include: {
      user: true,
      _count: {
        select: { messages: true }
      }
    }
  });

  console.log("\nLast 5 Sessions:");
  lastSessions.forEach(s => {
    console.log(`Session: ${s.id}, User: ${s.user.id} (${s.user.name}), Updated: ${s.updatedAt.toISOString()}, Messages: ${s._count.messages}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
