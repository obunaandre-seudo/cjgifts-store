import './load-env.js';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const globalKey = 'bpointPrismaClient';

export function getDatabaseConfigurationError() {
  const databaseUrl = process.env.DATABASE_URL_POOLED?.trim();
  if (!databaseUrl) return 'DATABASE_URL_POOLED is not configured.';

  try {
    if (new URL(databaseUrl).protocol !== 'postgresql:') {
      return 'DATABASE_URL_POOLED must use the postgresql:// protocol.';
    }
  } catch {
    return 'DATABASE_URL_POOLED must be a valid postgresql:// connection string.';
  }

  return null;
}

function getPrismaClient() {
  const configurationError = getDatabaseConfigurationError();
  if (configurationError) throw new Error(configurationError);

  if (!globalForPrisma[globalKey]) {
    globalForPrisma[globalKey] = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_POOLED.trim() } },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    });
  }

  return globalForPrisma[globalKey];
}

export const prisma = new Proxy(Object.create(null), {
  get(_target, property) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set(_target, property, value) {
    const client = getPrismaClient();
    return Reflect.set(client, property, value, client);
  }
});
