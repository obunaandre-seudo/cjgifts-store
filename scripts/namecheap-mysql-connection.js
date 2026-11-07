import { createNamecheapClient, EXPECTED_NAMECHEAP_DATABASE, getNamecheapDatabaseUrl } from './mysql-migration-common.js';

const REQUIRED_SCHEMA_PRIVILEGES = ['CREATE', 'ALTER', 'INDEX', 'REFERENCES'];
const EXPECTED_MARIADB_VERSION = '11.4.13';

export function grantsForCurrentDatabase(grantRows, databaseName) {
  const grants = [];
  for (const row of grantRows) {
    for (const value of Object.values(row)) {
      if (typeof value !== 'string') continue;
      const match = value.match(/^\s*GRANT\s+(.+?)\s+ON\s+(.+?)\s+TO\s+/i);
      if (!match) continue;
      const scope = match[2].replace(/[`"']/g, '').replace(/\s/g, '').toLowerCase();
      if (scope !== '*.*' && scope !== `${databaseName.toLowerCase()}.*`) continue;
      const privileges = match[1].toUpperCase();
      grants.push(...(privileges.includes('ALL PRIVILEGES') ? REQUIRED_SCHEMA_PRIVILEGES : privileges.split(',').map((item) => item.trim())));
    }
  }
  return new Set(grants);
}

export async function checkNamecheapConnection({ report = true } = {}) {
  const client = await createNamecheapClient();
  try {
    await client.$connect();
    const [identity] = await client.$queryRaw`
      SELECT DATABASE() AS databaseName,
             VERSION() AS serverVersion,
             @@port AS serverPort,
             @@character_set_database AS characterSet,
             @@collation_database AS collation
    `;
    const failures = [];
    if (identity.databaseName !== EXPECTED_NAMECHEAP_DATABASE) failures.push('database name does not match the confirmed target');
    if (!String(identity.serverVersion).startsWith(EXPECTED_MARIADB_VERSION) || !String(identity.serverVersion).toLowerCase().includes('mariadb')) failures.push('server is not the confirmed MariaDB 11.4.13 instance');
    if (Number(identity.serverPort) !== 3306) failures.push('server port is not 3306');
    if (identity.characterSet !== 'utf8mb4') failures.push('database character set is not utf8mb4');
    if (identity.collation !== 'utf8mb4_bin') failures.push('database collation is not utf8mb4_bin');

    const [objectCountRow] = await client.$queryRaw`
      SELECT COUNT(*) AS objectCount
      FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `;
    const objectCount = Number(objectCountRow.objectCount);
    if (objectCount !== 0) failures.push(`target is not empty (${objectCount} table or view object(s))`);

    const grantRows = await client.$queryRawUnsafe('SHOW GRANTS');
    const grants = grantsForCurrentDatabase(grantRows, EXPECTED_NAMECHEAP_DATABASE);
    const missingPrivileges = REQUIRED_SCHEMA_PRIVILEGES.filter((privilege) => !grants.has(privilege));
    if (missingPrivileges.length) failures.push(`missing target-scoped schema privileges: ${missingPrivileges.join(', ')}`);

    if (failures.length) throw new Error(`Namecheap connection check failed: ${failures.join('; ')}. No persistent tables were created.`);

    if (report) {
      console.log('PASS: connected to the expected database.');
      console.log(`Database: ${identity.databaseName}`);
      console.log(`Server: MariaDB ${identity.serverVersion}`);
      console.log(`Port: ${identity.serverPort}`);
      console.log(`Character set/collation: ${identity.characterSet} / ${identity.collation}`);
      console.log(`Persistent tables/views before schema setup: ${objectCount}`);
      console.log(`PASS: target-scoped ${REQUIRED_SCHEMA_PRIVILEGES.join(', ')} privileges are granted.`);
      console.log('No persistent tables or rows were created or modified.');
    }
    return { databaseName: identity.databaseName, serverVersion: identity.serverVersion, port: Number(identity.serverPort), characterSet: identity.characterSet, collation: identity.collation, objectCount, grants: [...grants] };
  } finally {
    await client.$disconnect();
  }
}

export function getTargetUrlForPrismaCli() {
  return getNamecheapDatabaseUrl();
}
