import { createClients, MODEL_DEFINITIONS, BATCH_SIZE, delegate, readRows, rowsToTargetData, findDuplicateUniqueValues, findMissingRelations, findFieldLengthConflicts, readDatabaseCollation } from './mysql-migration-common.js';

const confirmation = 'COPY_NEON_READ_ONLY_TO_EMPTY_NAMECHEAP_TARGET';
async function main() {
  if (process.env.CJGIFTS_MIGRATION_CONFIRM !== confirmation) {
    throw new Error(`Migration stopped before connecting. Set CJGIFTS_MIGRATION_CONFIRM=${confirmation} only when explicitly ready to copy to a new, empty target.`);
  }

  const { source, target } = await createClients();
  try {
    await Promise.all([source.$connect(), target.$connect()]);

  const targetCounts = {};
  for (const { name } of MODEL_DEFINITIONS) targetCounts[name] = await delegate(target, name).count();
  if (Object.values(targetCounts).some((count) => count !== 0)) {
    throw new Error('Target database is not empty. No data was written. Use a newly created empty target database.');
  }

  const collationInfo = await readDatabaseCollation(target);
  const collation = String(collationInfo.collation ?? 'unknown');
  if (!collation.endsWith('_bin')) {
    throw new Error(`Target collation is ${collation}; migration requires a binary database collation to preserve PostgreSQL's case-sensitive unique comparisons. No source records were read and no target rows were written.`);
  }

  const sourceRows = await source.$transaction(async (readOnlySnapshot) => {
    await readOnlySnapshot.$executeRaw`SET TRANSACTION READ ONLY`;
    const rowsByModel = {};
    for (const { name } of MODEL_DEFINITIONS) rowsByModel[name] = await readRows(readOnlySnapshot, name);
    return rowsByModel;
  }, { isolationLevel: 'RepeatableRead', timeout: 900000 });

  const uniqueConflicts = MODEL_DEFINITIONS.flatMap(({ name }) => findDuplicateUniqueValues(name, sourceRows[name]));
  const fieldLengthConflicts = MODEL_DEFINITIONS.flatMap(({ name }) => findFieldLengthConflicts(name, sourceRows[name]));
  const missingRelations = findMissingRelations(sourceRows);
  if (uniqueConflicts.length || fieldLengthConflicts.length || missingRelations.length) {
    throw new Error(`Source preflight failed: ${uniqueConflicts.length} target-collation unique conflict(s), ${fieldLengthConflicts.length} MySQL string length conflict(s), ${missingRelations.length} broken relation(s). Target is still empty.`);
  }

  for (const { name } of MODEL_DEFINITIONS) {
    const rows = sourceRows[name];
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = rowsToTargetData(name, rows.slice(offset, offset + BATCH_SIZE));
      if (batch.length) await delegate(target, name).createMany({ data: batch });
    }
    console.log(`Copied ${name}: ${rows.length} row(s).`);
  }

    console.log('Copy finished. Run npm run db:mysql:verify to compare all records and relationships.');
  } finally {
    await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
  }
}

main().catch((error) => {
  const message = String(error?.message ?? error).replace(/(postgres(?:ql)?|mysql):\/\/[^@\s]+@/gi, '$1://[REDACTED]@');
  console.error(`Migration aborted: ${message}`);
  process.exitCode = 1;
});
