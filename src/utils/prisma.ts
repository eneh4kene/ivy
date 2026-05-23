import { PrismaClient } from '@prisma/client';
import { config } from '../config';

const prisma = new PrismaClient({
  log: config.server.env === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Neon closes idle connections after ~5 minutes. Ping every 4 minutes to keep the
// connection pool alive and avoid cascading errors on the next real query.
if (config.server.env === 'production') {
  setInterval(async () => {
    await prisma.$queryRaw`SELECT 1`.catch(() => {
      // Silently swallow — Prisma will reconnect on the next real query.
    });
  }, 4 * 60 * 1000);
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
