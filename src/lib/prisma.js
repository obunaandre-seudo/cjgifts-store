import './load-env.js';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const pooledDatabaseUrl = process.env.DATABASE_URL_POOLED?.trim();

if (!pooledDatabaseUrl) {
  throw new Error('DATABASE_URL_POOLED must be set to the Neon pooled PostgreSQL connection string.');
}

let pooledDatabaseProtocol;
try {
  pooledDatabaseProtocol = new URL(pooledDatabaseUrl).protocol;
} catch {
  throw new Error('DATABASE_URL_POOLED must be a valid postgresql:// connection string.');
}
if (pooledDatabaseProtocol !== 'postgresql:') {
  throw new Error('DATABASE_URL_POOLED must use the postgresql:// protocol for the application database.');
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: pooledDatabaseUrl } },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
