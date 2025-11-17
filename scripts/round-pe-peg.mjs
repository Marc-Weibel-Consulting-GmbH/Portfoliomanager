import { drizzle } from 'drizzle-orm/mysql2';
import { stocks } from '../drizzle/schema.ts';
import { sql } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

console.log('[Round P/E & PEG] Starting...');

// Update P/E and PEG ratios to 1 decimal place
const result = await db.execute(sql`
  UPDATE stocks
  SET 
    peRatio = ROUND(peRatio, 1),
    pegRatio = ROUND(pegRatio, 1)
  WHERE peRatio IS NOT NULL OR pegRatio IS NOT NULL
`);

console.log(`[Round P/E & PEG] Updated ${result[0].affectedRows} stocks`);

// Verify
const samples = await db.select().from(stocks).limit(5);
console.log('[Round P/E & PEG] Sample stocks:');
samples.forEach(s => {
  console.log(`  ${s.ticker}: P/E=${s.peRatio}, PEG=${s.pegRatio}`);
});

console.log('[Round P/E & PEG] Done!');
process.exit(0);
