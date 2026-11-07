import 'dotenv/config';
import { createRequire } from 'node:module';
import path from 'node:path';

export const MODEL_DEFINITIONS = [
  { name: 'Customer', unique: ['id', 'email'], decimals: [], bounded191: ['id', 'passwordHash'], bounded320: ['email'], relations: [] },
  { name: 'CustomerSession', unique: ['id', 'tokenHash'], decimals: [], bounded191: ['id', 'tokenHash', 'customerId'], relations: [['customerId', 'Customer']] },
  { name: 'AdminUser', unique: ['id', 'email'], decimals: [], bounded191: ['id', 'passwordHash', 'role'], bounded320: ['email'], relations: [] },
  { name: 'AdminSession', unique: ['id', 'tokenHash'], decimals: [], bounded191: ['id', 'tokenHash', 'adminId'], relations: [['adminId', 'AdminUser']] },
  { name: 'Product', unique: ['id', 'sku', 'slug'], decimals: ['price', 'salePrice'], bounded191: ['id', 'sku', 'slug', 'priceCurrency', 'category'], relations: [] },
  { name: 'Order', unique: ['id', 'orderNumber', 'accessToken'], decimals: ['total', 'subtotal', 'shippingFee', 'tax'], bounded191: ['id', 'orderNumber', 'accessToken', 'customerId', 'currency', 'paymentStatus', 'paymentMode', 'fulfillmentStatus'], relations: [['customerId', 'Customer']] },
  { name: 'OrderItem', unique: ['id'], decimals: ['unitPrice'], bounded191: ['id', 'orderId', 'productId', 'sku'], relations: [['orderId', 'Order'], ['productId', 'Product']] },
  { name: 'Payment', unique: ['id', 'reference'], decimals: ['amount'], bounded191: ['id', 'orderId', 'reference', 'currency', 'provider', 'mode', 'status'], relations: [['orderId', 'Order']] },
  { name: 'DeliveryZone', unique: ['id', 'code'], decimals: ['shippingFee'], bounded191: ['id', 'code'], relations: [] }
];

export const BATCH_SIZE = 500;
export const EXPECTED_NAMECHEAP_DATABASE = 'cjgiwmmk_cjgifts';

export function getNamecheapDatabaseUrl() {
  const host = process.env.NAMECHEAP_DB_HOST?.trim();
  const port = process.env.NAMECHEAP_DB_PORT?.trim();
  const database = process.env.NAMECHEAP_DB_NAME?.trim();
  const username = process.env.NAMECHEAP_DB_USER;
  const password = process.env.NAMECHEAP_DB_PASSWORD;
  if (!host || !port || !database || !username || !password) {
    throw new Error('Set NAMECHEAP_DB_HOST, NAMECHEAP_DB_PORT, NAMECHEAP_DB_NAME, NAMECHEAP_DB_USER, and NAMECHEAP_DB_PASSWORD securely. Values are never printed.');
  }
  if (!/^([a-z0-9.-]+|\[[0-9a-f:]+\])$/i.test(host) || Number(port) !== 3306 || database !== EXPECTED_NAMECHEAP_DATABASE) {
    throw new Error(`Target must use the confirmed Namecheap database ${EXPECTED_NAMECHEAP_DATABASE} on port 3306 and a hostname supplied by Namecheap.`);
  }
  const url = new URL(`mysql://${host}:${port}/${encodeURIComponent(database)}`);
  url.username = username;
  url.password = password;
  return url.toString();
}

export function getConnectionUrls() {
  const sourceUrl = process.env.NEON_SOURCE_DATABASE_URL;
  const targetUrl = getNamecheapDatabaseUrl();
  if (!sourceUrl || !targetUrl) {
    throw new Error('Set NEON_SOURCE_DATABASE_URL and the Namecheap database environment variables securely. Values are never printed.');
  }
  if (!/^postgres(?:ql)?:\/\//i.test(sourceUrl)) {
    throw new Error('NEON_SOURCE_DATABASE_URL must use the PostgreSQL protocol.');
  }
  if (!/^mysql:\/\//i.test(targetUrl)) {
    throw new Error('The configured Namecheap target must use the mysql:// protocol.');
  }
  return { sourceUrl, targetUrl };
}

export async function createClients() {
  const require = createRequire(import.meta.url);
  const postgresClientPath = path.resolve('node_modules/.prisma/cjgifts-postgres-client');
  const mysqlClientPath = path.resolve('node_modules/.prisma/cjgifts-mysql-client');
  let PostgresClient;
  let MysqlClient;
  try {
    ({ PrismaClient: PostgresClient } = require(postgresClientPath));
  } catch {
    throw new Error('Generate the isolated Neon source client first with: npm run db:postgres:source:generate');
  }
  try {
    ({ PrismaClient: MysqlClient } = require(mysqlClientPath));
  } catch {
    throw new Error('Generate the isolated MySQL client first with: npm run db:mysql:generate');
  }
  const { sourceUrl, targetUrl } = getConnectionUrls();
  return {
    source: new PostgresClient({ datasources: { db: { url: sourceUrl } }, log: ['error'] }),
    target: new MysqlClient({ datasources: { db: { url: targetUrl } }, log: ['error'] })
  };
}

export async function createNamecheapClient() {
  const require = createRequire(import.meta.url);
  const mysqlClientPath = path.resolve('node_modules/.prisma/cjgifts-mysql-client');
  let MysqlClient;
  try {
    ({ PrismaClient: MysqlClient } = require(mysqlClientPath));
  } catch {
    throw new Error('Generate the isolated MySQL client first with: npm run db:mysql:generate');
  }
  return new MysqlClient({ datasources: { db: { url: getNamecheapDatabaseUrl() } }, log: ['error'] });
}

export function delegate(client, modelName) {
  return client[modelName[0].toLowerCase() + modelName.slice(1)];
}

export async function readRows(client, modelName) {
  return delegate(client, modelName).findMany({ orderBy: { id: 'asc' } });
}

export function rowsToTargetData(modelName, rows) {
  const decimalFields = new Set(MODEL_DEFINITIONS.find((model) => model.name === modelName).decimals);
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key,
    decimalFields.has(key) && value !== null ? value.toString() : value
  ])));
}

export function stableValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toString === 'function' && value.constructor?.name === 'Decimal') return value.toString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value.toString('base64');
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function rowFingerprint(row) {
  return JSON.stringify(stableValue(row));
}

export function findDuplicateUniqueValues(modelName, rows, caseInsensitive = false) {
  const definition = MODEL_DEFINITIONS.find((model) => model.name === modelName);
  const conflicts = [];
  for (const field of definition.unique) {
    const seen = new Map();
    for (const row of rows) {
      const value = row[field];
      if (value === null || value === undefined) continue;
      let key = String(value);
      if (caseInsensitive) key = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US');
      const previousId = seen.get(key);
      if (previousId !== undefined) conflicts.push({ modelName, field, firstId: previousId, duplicateId: row.id });
      else seen.set(key, row.id);
    }
  }
  return conflicts;
}

export function findFieldLengthConflicts(modelName, rows) {
  const definition = MODEL_DEFINITIONS.find((model) => model.name === modelName);
  const conflicts = [];
  for (const row of rows) {
    for (const field of definition.bounded191 ?? []) {
      if (typeof row[field] === 'string' && [...row[field]].length > 191) conflicts.push({ modelName, id: row.id, field, maxLength: 191 });
    }
    for (const field of definition.bounded320 ?? []) {
      if (typeof row[field] === 'string' && [...row[field]].length > 320) conflicts.push({ modelName, id: row.id, field, maxLength: 320 });
    }
  }
  return conflicts;
}

export function findMissingRelations(rowsByModel) {
  const missing = [];
  for (const definition of MODEL_DEFINITIONS) {
    const sourceRows = rowsByModel[definition.name] ?? [];
    for (const [foreignKey, parentModel] of definition.relations) {
      const parentIds = new Set((rowsByModel[parentModel] ?? []).map((row) => row.id));
      for (const row of sourceRows) {
        if (!parentIds.has(row[foreignKey])) missing.push({ modelName: definition.name, id: row.id, foreignKey, parentModel, parentId: row[foreignKey] });
      }
    }
  }
  return missing;
}

export async function readDatabaseCollation(mysqlClient) {
  const result = await mysqlClient.$queryRaw`SELECT @@character_set_database AS characterSet, @@collation_database AS collation`;
  return result[0] ?? {};
}
