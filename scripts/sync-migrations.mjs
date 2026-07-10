/**
 * sync-migrations.mjs
 * Replaces the __drizzle_migrations table entries with the correct hashes
 * from the local SQL migration files, so drizzle-kit migrate knows all
 * migrations are already applied and won't try to re-create existing tables.
 *
 * Usage: node scripts/sync-migrations.mjs
 */
import { createConnection } from "mysql2/promise";
import { createHash } from "crypto";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIZZLE_DIR = join(__dirname, "../drizzle");

// Drizzle uses SHA-256 of the file content (not the filename)
function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const conn = await createConnection(url);

  // Get all .sql migration files sorted by name
  const sqlFiles = readdirSync(DRIZZLE_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Found ${sqlFiles.length} migration files`);

  // Get current DB state
  const [existing] = await conn.query("SELECT hash FROM `__drizzle_migrations`");
  const existingHashes = new Set(existing.map((r) => r.hash));
  console.log(`DB has ${existingHashes.size} migration records`);

  // Compute hashes for all local files
  const localHashes = sqlFiles.map((f) => ({
    file: f,
    hash: hashFile(join(DRIZZLE_DIR, f)),
  }));

  // Insert missing hashes (those not yet in DB)
  let inserted = 0;
  const now = Date.now();
  for (let i = 0; i < localHashes.length; i++) {
    const { file, hash } = localHashes[i];
    if (!existingHashes.has(hash)) {
      // Use sequential timestamps to maintain order
      const ts = now + i;
      await conn.query(
        "INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)",
        [hash, ts]
      );
      console.log(`  ✓ Inserted: ${file} (${hash.slice(0, 12)}...)`);
      inserted++;
    } else {
      console.log(`  - Already present: ${file}`);
    }
  }

  console.log(`\nDone. Inserted ${inserted} new migration records.`);
  await conn.end();
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
