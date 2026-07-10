import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Check current version values
  const [rows] = await conn.execute("SELECT id, version FROM modelArtifacts LIMIT 5");
  console.log('Current version values:', rows);

  // Update version to numeric if it's not
  await conn.execute("UPDATE modelArtifacts SET version = 1 WHERE version IS NULL OR version = '' OR version NOT REGEXP '^[0-9]+$'");
  console.log('Normalized version values');

  // Now convert version to INT
  await conn.execute("ALTER TABLE modelArtifacts MODIFY COLUMN version INT NOT NULL DEFAULT 1");
  console.log('version → INT done');

  // Fix modelBlob
  await conn.execute("ALTER TABLE modelArtifacts MODIFY COLUMN modelBlob LONGTEXT NULL");
  console.log('modelBlob → LONGTEXT done');

  // Add unique index
  try {
    await conn.execute("ALTER TABLE modelArtifacts ADD UNIQUE INDEX uq_kind_version (kind, version)");
    console.log('Added unique index kind+version');
  } catch(e) {
    console.log('Unique index note:', e.message);
  }

  const [cols] = await conn.execute('SHOW COLUMNS FROM modelArtifacts');
  console.log('Done. Columns:', cols.map(c => c.Field + ':' + c.Type.substring(0,20)));
} catch(e) {
  console.error('FAIL:', e.message);
} finally {
  await conn.end();
  process.exit(0);
}
