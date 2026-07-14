// Migration: add alertCooldownDays to alertConfig, add lastAlertSentAt to stocks
const mysql2 = require('mysql2/promise');

async function migrate() {
  const conn = await mysql2.createConnection(process.env.DATABASE_URL);
  try {
    // 1. Add alertCooldownDays to alertConfig
    try {
      await conn.execute('ALTER TABLE alertConfig ADD COLUMN alertCooldownDays INT NOT NULL DEFAULT 7');
      console.log('✅ alertConfig.alertCooldownDays added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  alertConfig.alertCooldownDays already exists');
      } else throw e;
    }

    // 2. Add lastAlertSentAt to stocks
    try {
      await conn.execute('ALTER TABLE stocks ADD COLUMN lastAlertSentAt TIMESTAMP NULL DEFAULT NULL');
      console.log('✅ stocks.lastAlertSentAt added');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️  stocks.lastAlertSentAt already exists');
      } else throw e;
    }

    console.log('Migration complete.');
  } finally {
    await conn.end();
  }
}

migrate().catch(e => { console.error(e); process.exit(1); });
