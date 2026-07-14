const mysql = require('mysql2/promise');

async function migrate() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS gapFillLog (
        id INT AUTO_INCREMENT PRIMARY KEY,
        runAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        triggeredBy VARCHAR(32) NOT NULL DEFAULT 'cron',
        gapsFound JSON NOT NULL,
        stocksAdded JSON NOT NULL,
        stocksSkipped INT NOT NULL DEFAULT 0,
        durationMs INT,
        error TEXT
      )
    `);
    console.log('✅ gapFillLog table created (or already exists)');
  } finally {
    await conn.end();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
