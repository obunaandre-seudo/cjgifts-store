import { createClients, MODEL_DEFINITIONS, delegate, readRows, rowFingerprint, findDuplicateUniqueValues, findMissingRelations, readDatabaseCollation } from './mysql-migration-common.js';

let failed = false;
async function main() {
const { source, target } = await createClients();
try {
  await Promise.all([source.$connect(), target.$connect()]);
  const targetCollation = await readDatabaseCollation(target);
  console.log(`Target character set/collation: ${targetCollation.characterSet ?? 'unknown'} / ${targetCollation.collation ?? 'unknown'}`);
  const targetIsCaseInsensitive = !String(targetCollation.collation ?? '').endsWith('_bin');
  if (targetIsCaseInsensitive) {
    failed = true;
    console.log('FAIL Target database collation is not binary; unique string semantics may differ from PostgreSQL.');
  }

  const targetRows = {};
  const sourceRows = await source.$transaction(async (readOnlySnapshot) => {
    await readOnlySnapshot.$executeRaw`SET TRANSACTION READ ONLY`;
    const rowsByModel = {};
    for (const { name } of MODEL_DEFINITIONS) rowsByModel[name] = await readRows(readOnlySnapshot, name);
    return rowsByModel;
  }, { isolationLevel: 'RepeatableRead', timeout: 900000 });
  for (const { name } of MODEL_DEFINITIONS) {
    targetRows[name] = await readRows(target, name);
    const sourceById = new Map(sourceRows[name].map((row) => [row.id, row]));
    const targetById = new Map(targetRows[name].map((row) => [row.id, row]));
    const missingIds = [...sourceById.keys()].filter((id) => !targetById.has(id));
    const extraIds = [...targetById.keys()].filter((id) => !sourceById.has(id));
    const changedRows = [...sourceById.keys()].filter((id) => targetById.has(id) && rowFingerprint(sourceById.get(id)) !== rowFingerprint(targetById.get(id)));
    const duplicateIds = targetRows[name].length - targetById.size;
    const countMatches = sourceRows[name].length === targetRows[name].length;
    const modelOk = countMatches && !missingIds.length && !extraIds.length && !changedRows.length && !duplicateIds;
    failed ||= !modelOk;
    console.log(`${modelOk ? 'PASS' : 'FAIL'} ${name}: source=${sourceRows[name].length}, target=${targetRows[name].length}, missingIds=${missingIds.length}, extraIds=${extraIds.length}, duplicateIds=${duplicateIds}, changedRows=${changedRows.length}`);
    if (missingIds.length || extraIds.length || changedRows.length) {
      console.log(`  Example IDs: missing=${missingIds.slice(0, 5).join(',') || '-'} extra=${extraIds.slice(0, 5).join(',') || '-'} changed=${changedRows.slice(0, 5).join(',') || '-'}`);
    }
  }

  const sourceOrphans = findMissingRelations(sourceRows);
  const targetOrphans = findMissingRelations(targetRows);
  failed ||= sourceOrphans.length > 0 || targetOrphans.length > 0;
  console.log(`${sourceOrphans.length === 0 ? 'PASS' : 'FAIL'} Source relation integrity: ${sourceOrphans.length} missing foreign key(s).`);
  console.log(`${targetOrphans.length === 0 ? 'PASS' : 'FAIL'} Target relation integrity: ${targetOrphans.length} orphan(s), including orphaned orders, order items, payments, and sessions.`);

  const sourceUniqueConflicts = MODEL_DEFINITIONS.flatMap(({ name }) => findDuplicateUniqueValues(name, sourceRows[name], targetIsCaseInsensitive));
  const targetUniqueConflicts = MODEL_DEFINITIONS.flatMap(({ name }) => findDuplicateUniqueValues(name, targetRows[name], targetIsCaseInsensitive));
  failed ||= sourceUniqueConflicts.length > 0 || targetUniqueConflicts.length > 0;
  console.log(`${sourceUniqueConflicts.length === 0 ? 'PASS' : 'FAIL'} Source unique values under target collation: ${sourceUniqueConflicts.length} conflict(s).`);
  console.log(`${targetUniqueConflicts.length === 0 ? 'PASS' : 'FAIL'} Target unique values under target collation: ${targetUniqueConflicts.length} conflict(s).`);

  if (failed) process.exitCode = 1;
  else console.log('All counts, IDs, scalar fields, Decimal values, JSON fields, timestamps, statuses, unique values, and relationships match.');
} finally {
  await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
}
}

main().catch((error) => {
  const message = String(error?.message ?? error).replace(/(postgres(?:ql)?|mysql):\/\/[^@\s]+@/gi, '$1://[REDACTED]@');
  console.error(`Verification aborted: ${message}`);
  process.exitCode = 1;
});
