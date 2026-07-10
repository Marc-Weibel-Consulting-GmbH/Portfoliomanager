/**
 * Fix remaining modelArtifacts column type mismatches.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Check unique constraint on version
  const [indexes] = await conn.execute("SHOW INDEX FROM modelArtifacts");
  console.log('Indexes:', indexes.map(i => `${i.Key_name}(${i.Column_name})`));

  // Drop unique constraint on kind+version if exists (blocks version type change)
  for (const idx of indexes) {
    if (idx.Key_name !== 'PRIMARY' && idx.Column_name === 'version') {
      try {
        await conn.execute(`DROP INDEX \`${idx.Key_name}\` ON modelArtifacts`);
        console.log(`Dropped index: ${idx.Key_name}`);
      } catch(e) {
        console.log(`Could not drop ${idx.Key_name}:`, e.message);
      }
    }
  }

  // Fix version to INT
  await conn.execute("ALTER TABLE modelArtifacts MODIFY COLUMN version INT NOT NULL DEFAULT 1");
  console.log('Fixed version to INT');

  // Fix modelBlob to LONGTEXT (base64 strings)
  await conn.execute("ALTER TABLE modelArtifacts MODIFY COLUMN modelBlob LONGTEXT NULL");
  console.log('Fixed modelBlob to LONGTEXT');

  // Re-add unique index on kind+version
  try {
    await conn.execute("ALTER TABLE modelArtifacts ADD UNIQUE INDEX `uq_model_artifacts_kind_version` (`kind`, `version`)");
    console.log('Re-added unique index on kind+version');
  } catch(e) {
    console.log('Unique index:', e.message);
  }

  // Show final structure
  const [cols] = await conn.execute('SHOW COLUMNS FROM modelArtifacts');
  console.log('\nFinal columns:');
  for (const c of cols) {
    console.log(`  ${c.Field}: ${c.Type} ${c.Null === 'NO' ? 'NOT NULL' : 'NULL'} DEFAULT=${c.Default}`);
  }

} catch(e) {
  console.error('Error:', e.message);
} finally {
  await conn.end();
}
