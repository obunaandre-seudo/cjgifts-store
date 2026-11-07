import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { Prisma } from '@prisma/client';
import { MODEL_DEFINITIONS, rowsToTargetData, stableValue, rowFingerprint, findDuplicateUniqueValues, findMissingRelations, findFieldLengthConflicts, getConnectionUrls, getNamecheapDatabaseUrl } from '../scripts/mysql-migration-common.js';
import { grantsForCurrentDatabase } from '../scripts/namecheap-mysql-connection.js';

test('MySQL migration schema covers all nine existing Prisma models', () => {
  assert.deepEqual(MODEL_DEFINITIONS.map(({ name }) => name), [
    'Customer', 'CustomerSession', 'AdminUser', 'AdminSession', 'Product', 'Order', 'OrderItem', 'Payment', 'DeliveryZone'
  ]);
});

test('migration retains Decimal values as exact decimal strings and keeps dates/JSON intact', () => {
  const createdAt = new Date('2026-10-06T12:34:56.789Z');
  const json = { nested: [1, { enabled: true }] };
  const [converted] = rowsToTargetData('Product', [{ id: 'p1', price: new Prisma.Decimal('1234567890.12'), salePrice: null, createdAt, images: json }]);
  assert.equal(converted.price, '1234567890.12');
  assert.equal(converted.salePrice, null);
  assert.equal(converted.createdAt, createdAt);
  assert.deepEqual(converted.images, json);
});

test('verification fingerprint sorts JSON object keys without changing array order', () => {
  assert.equal(rowFingerprint({ id: 'p1', images: { b: 2, a: [1, 3] } }), rowFingerprint({ images: { a: [1, 3], b: 2 }, id: 'p1' }));
  assert.notEqual(stableValue([1, 2]).join(','), stableValue([2, 1]).join(','));
});

test('target collation preflight identifies case-insensitive unique collisions', () => {
  const rows = [{ id: '1', email: 'Shop@example.com' }, { id: '2', email: 'shop@example.com' }];
  assert.equal(findDuplicateUniqueValues('Customer', rows, false).length, 0);
  assert.equal(findDuplicateUniqueValues('Customer', rows, true).length, 1);
});

test('migration preflight catches MySQL VARCHAR size overflows while allowing mapped long text', () => {
  const description = 'x'.repeat(1000);
  assert.equal(findFieldLengthConflicts('Product', [{ id: 'p1', sku: 'sku', slug: 'slug', name: description, description }]).length, 0);
  assert.equal(findFieldLengthConflicts('Customer', [{ id: 'c1', email: `${'x'.repeat(320)}@a.com`, passwordHash: 'hash' }]).length, 1);
});

test('connection check recognizes only target-scoped schema-creation grants', () => {
  const granted = grantsForCurrentDatabase([
    { Grants: 'GRANT USAGE ON *.* TO `shop`@`localhost`' },
    { Grants: 'GRANT CREATE, ALTER, INDEX, REFERENCES ON `cjgiwmmk_cjgifts`.* TO `shop`@`localhost`' }
  ], 'cjgiwmmk_cjgifts');
  assert.deepEqual(['CREATE', 'ALTER', 'INDEX', 'REFERENCES'].map((privilege) => granted.has(privilege)), [true, true, true, true]);
  const wrongDatabase = grantsForCurrentDatabase([
    { Grants: 'GRANT ALL PRIVILEGES ON `another_database`.* TO `shop`@`localhost`' }
  ], 'cjgiwmmk_cjgifts');
  assert.equal(wrongDatabase.size, 0);
});

test('relationship preflight identifies orphaned order items and payments', () => {
  const orphans = findMissingRelations({
    Customer: [], CustomerSession: [], AdminUser: [], AdminSession: [], Product: [], Order: [],
    OrderItem: [{ id: 'item1', orderId: 'missing-order', productId: 'missing-product' }],
    Payment: [{ id: 'payment1', orderId: 'missing-order' }], DeliveryZone: []
  });
  assert.equal(orphans.length, 3);
});

test('connection URL validation requires explicit PostgreSQL source and MySQL target variables', () => {
  const names = ['NEON_SOURCE_DATABASE_URL', 'NAMECHEAP_DB_HOST', 'NAMECHEAP_DB_PORT', 'NAMECHEAP_DB_NAME', 'NAMECHEAP_DB_USER', 'NAMECHEAP_DB_PASSWORD'];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) delete process.env[name];
    assert.throws(getConnectionUrls, /NAMECHEAP_DB_HOST/);
    process.env.NEON_SOURCE_DATABASE_URL = 'postgresql://readonly:secret@example.invalid/source';
    process.env.NAMECHEAP_DB_HOST = 'db.example.invalid';
    process.env.NAMECHEAP_DB_PORT = '3306';
    process.env.NAMECHEAP_DB_NAME = 'cjgiwmmk_cjgifts';
    process.env.NAMECHEAP_DB_USER = 'target-user';
    process.env.NAMECHEAP_DB_PASSWORD = 'test password with @:/?#';
    const urls = getConnectionUrls();
    assert.equal(new URL(urls.sourceUrl).protocol, 'postgresql:');
    assert.equal(new URL(urls.targetUrl).protocol, 'mysql:');
    assert.equal(new URL(urls.targetUrl).pathname, '/cjgiwmmk_cjgifts');
    assert.match(urls.targetUrl, /test%20password%20with%20%40%3A%2F%3F%23/);
    process.env.NAMECHEAP_DB_NAME = 'a-different-database';
    assert.throws(getNamecheapDatabaseUrl, /cjgiwmmk_cjgifts/);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test('runtime selects the pooled PostgreSQL Prisma client without opening a database connection', () => {
  const probe = "const { prisma } = await import('./src/lib/prisma.js'); if (prisma._engineConfig.activeProvider !== 'postgresql') process.exit(2); await prisma.$disconnect(); console.log('postgresql client selected');";
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', probe], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      DATABASE_URL_POOLED: 'postgresql://test:test@localhost:5432/cjgifts_schema_check',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/cjgifts_schema_check'
    }
  });
  assert.match(output, /postgresql client selected/);
});
