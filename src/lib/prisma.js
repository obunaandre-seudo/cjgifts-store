import './load-env.js';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const globalKey = 'bpointPrismaClient';

export function getRuntimeDatabaseUrl() {
  return process.env.DATABASE_URL_POOLED?.trim()
    || process.env.DATABASE_URL?.trim()
    || process.env.DATABASE_URL_UNPOOLED?.trim()
    || null;
}

export function getDatabaseConfigurationError() {
  const databaseUrl = getRuntimeDatabaseUrl();
  if (!databaseUrl) return 'Set DATABASE_URL_POOLED or DATABASE_URL in the hosting environment.';

  try {
    if (new URL(databaseUrl).protocol !== 'postgresql:') {
      return 'The runtime database URL must use the postgresql:// protocol.';
    }
  } catch {
    return 'The runtime database URL must be a valid postgresql:// connection string.';
  }

  return null;
}

function getPrismaClient() {
  const configurationError = getDatabaseConfigurationError();
  if (configurationError) throw new Error(configurationError);

  if (!globalForPrisma[globalKey]) {
    globalForPrisma[globalKey] = new PrismaClient({
      datasources: { db: { url: getRuntimeDatabaseUrl() } },
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
