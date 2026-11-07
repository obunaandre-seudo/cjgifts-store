import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const schemaPath = path.join(projectRoot, 'prisma', 'schema.prisma');

if (!fs.existsSync(schemaPath)) {
  throw new Error(`Application Prisma schema not found at ${schemaPath}`);
}

const schema = fs.readFileSync(schemaPath, 'utf8');
if (!/datasource\s+db\s*\{[^}]*provider\s*=\s*"postgresql"/s.test(schema)) {
  throw new Error(`Expected the application datasource in ${schemaPath} to use PostgreSQL.`);
}

const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
const prismaCli = requireFromProject.resolve('prisma/build/index.js');
console.log(`Generating Prisma Client from ${schemaPath}`);

const result = spawnSync(process.execPath, [prismaCli, 'generate', `--schema=${schemaPath}`], {
  cwd: projectRoot,
  stdio: 'inherit'
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
