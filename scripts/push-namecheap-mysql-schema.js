import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { checkNamecheapConnection, getTargetUrlForPrismaCli } from './namecheap-mysql-connection.js';

const confirmation = 'CREATE_SCHEMA_ON_VERIFIED_EMPTY_NAMECHEAP_DATABASE';
if (process.env.CJGIFTS_SCHEMA_CREATE_CONFIRM !== confirmation) {
  console.error(`Schema setup stopped before connecting. Set CJGIFTS_SCHEMA_CREATE_CONFIRM=${confirmation} only when explicitly approved to create tables on the verified empty Namecheap target.`);
  process.exitCode = 1;
} else {
  try {
    await checkNamecheapConnection();
    const env = { ...process.env, NAMECHEAP_MYSQL_TARGET_URL: getTargetUrlForPrismaCli() };
    const prismaCli = path.resolve('node_modules/prisma/build/index.js');
    execFileSync(process.execPath, [prismaCli, 'db', 'push', '--schema=prisma/schema.mysql.prisma'], { stdio: 'inherit', env });
  } catch (error) {
    const message = String(error?.message ?? error).replace(/mysql:\/\/[^@\s]+@/gi, 'mysql://[REDACTED]@');
    console.error(`Schema setup aborted: ${message}`);
    process.exitCode = 1;
  }
}
