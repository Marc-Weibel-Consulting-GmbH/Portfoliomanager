import { getDb } from './server/db';

async function main() {
  const db = await getDb();
  if (!db) { console.error("No DB"); return; }
  
  const { sql } = await import('drizzle-orm');
  const rows = await db.execute(sql`
    SELECT id, status, progress, createdAt 
    FROM proposalJobs 
    ORDER BY createdAt DESC 
    LIMIT 5
  `);
  
  for (const row of (rows as any)[0] ?? []) {
    console.log("\n=== Job", row.id, "| Status:", row.status, "| Created:", row.createdAt, "===");
    try {
      const progress = typeof row.progress === 'string' ? JSON.parse(row.progress) : row.progress;
      if (Array.isArray(progress)) {
        progress.forEach((p: string) => console.log(" -", p));
      } else {
        console.log(progress);
      }
    } catch(e) {
      console.log("Raw progress:", String(row.progress).substring(0, 500));
    }
  }
}

main().catch(console.error);
