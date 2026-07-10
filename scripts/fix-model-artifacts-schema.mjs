/**
 * Fix modelArtifacts table schema to match current Drizzle schema.
 */
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // 1. Check current status values
  const [rows] = await conn.execute("SELECT DISTINCT status FROM modelArtifacts");
  console.log('Current status values:', rows.map(r => r.status));

  // 2. First change status column to VARCHAR to allow any value temporarily
  await conn.execute("ALTER TABLE modelArtifacts MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'candidate'");
  console.log('Changed status to VARCHAR');

  // 3. Update any non-standard values
  await conn.execute("UPDATE modelArtifacts SET status = 'candidate' WHERE status NOT IN ('candidate', 'active', 'archived', 'failed')");
  console.log('Updated non-standard status values');

  // 4. Now change back to proper ENUM
  await conn.execute("ALTER TABLE modelArtifacts MODIFY COLUMN status ENUM('candidate', 'active', 'archived', 'failed') NOT NULL DEFAULT 'candidate'");
  console.log('Fixed status enum');

  // 5. Drop index on promoted column if exists, then drop column
  try {
    const [indexes] = await conn.execute("SHOW INDEX FROM modelArtifacts WHERE Column_name = 'promoted'");
    for (const idx of indexes) {
      if (idx.Key_name !== 'PRIMARY') {
        await conn.execute(`DROP INDEX \`${idx.Key_name}\` ON modelArtifacts`);
        console.log(`Dropped index: ${idx.Key_name}`);
      }
    }
    await conn.execute('ALTER TABLE modelArtifacts DROP COLUMN promoted');
    console.log('Dropped promoted column');
  } catch(e) {
    console.log('promoted column handling:', e.message);
  }

  // 6. Show final structure
  const [cols] = await conn.execute('SHOW COLUMNS FROM modelArtifacts');
  console.log('Final columns:', cols.map(c => `${c.Field} (${c.Type.substring(0, 30)})`));

} catch(e) {
  console.error('Error:', e.message);
} finally {
  await conn.end();
}
