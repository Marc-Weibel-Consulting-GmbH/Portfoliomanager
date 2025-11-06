import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL);

// Query saved portfolios
const result = await db.execute('SELECT id, name, LEFT(portfolioData, 500) as portfolioData_preview FROM savedPortfolios LIMIT 2');

console.log('=== Saved Portfolios Data Structure ===');
console.log(JSON.stringify(result, null, 2));

process.exit(0);
