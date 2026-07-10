import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // modelBlob is currently LONGBLOB (binary). We need LONGTEXT (utf8mb4).
  // MySQL doesn't allow direct binary→text conversion — we need to:
  // 1. Add a new temp column
  // 2. Copy data (base64 is ASCII-safe)
  // 3. Drop old column
  // 4. Rename new column

  // Check if modelBlob has any data
  const [blobRows] = await conn.execute("SELECT id, LENGTH(modelBlob) as len FROM modelArtifacts WHERE modelBlob IS NOT NULL LIMIT 3");
  console.log('modelBlob rows with data:', blobRows);

  // Add temp text column
  await conn.execute("ALTER TABLE modelArtifacts ADD COLUMN modelBlobText LONGTEXT NULL AFTER modelBlob");
  console.log('Added modelBlobText column');

  // Copy data (CONVERT binary to utf8mb4)
  await conn.execute("UPDATE modelArtifacts SET modelBlobText = CONVERT(modelBlob USING utf8mb4) WHERE modelBlob IS NOT NULL");
  console.log('Copied data to modelBlobText');

  // Drop old binary column
  await conn.execute("ALTER TABLE modelArtifacts DROP COLUMN modelBlob");
  console.log('Dropped modelBlob (LONGBLOB)');

  // Rename new column
  await conn.execute("ALTER TABLE modelArtifacts RENAME COLUMN modelBlobText TO modelBlob");
  console.log('Renamed modelBlobText → modelBlob');

  // Add unique index
  try {
    await conn.execute("ALTER TABLE modelArtifacts ADD UNIQUE INDEX uq_kind_version (kind, version)");
    console.log('Added unique index kind+version');
  } catch(e) {
    console.log('Unique index note:', e.message);
  }

  const [cols] = await conn.execute('SHOW COLUMNS FROM modelArtifacts');
  console.log('\nFinal columns:');
  for (const c of cols) {
    console.log(`  ${c.Field}: ${c.Type.substring(0,30)}`);
  }
} catch(e) {
  console.error('FAIL:', e.message);
} finally {
  await conn.end();
  process.exit(0);
}
