import { checkNamecheapConnection } from './namecheap-mysql-connection.js';

checkNamecheapConnection().catch((error) => {
  const message = String(error?.message ?? error).replace(/mysql:\/\/[^@\s]+@/gi, 'mysql://[REDACTED]@');
  console.error(`Connection check aborted: ${message}`);
  process.exitCode = 1;
});
