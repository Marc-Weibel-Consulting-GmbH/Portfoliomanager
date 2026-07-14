const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  const sql = `
    CREATE TABLE IF NOT EXISTS alertConfig (
      id INT PRIMARY KEY DEFAULT 1,
      peLow DECIMAL(6,1) NOT NULL DEFAULT 15,
      peMedium DECIMAL(6,1) NOT NULL DEFAULT 20,
      peHigh DECIMAL(6,1) NOT NULL DEFAULT 40,
      peVeryHigh DECIMAL(6,1) NOT NULL DEFAULT 60,
      peLowPoints INT NOT NULL DEFAULT 12,
      peMediumPoints INT NOT NULL DEFAULT 6,
      peHighPoints INT NOT NULL DEFAULT -8,
      peVeryHighPoints INT NOT NULL DEFAULT -15,
      divHigh DECIMAL(5,3) NOT NULL DEFAULT 0.04,
      divMedium DECIMAL(5,3) NOT NULL DEFAULT 0.025,
      divHighPoints INT NOT NULL DEFAULT 12,
      divMediumPoints INT NOT NULL DEFAULT 6,
      week52NearLow DECIMAL(4,2) NOT NULL DEFAULT 0.20,
      week52BelowMid DECIMAL(4,2) NOT NULL DEFAULT 0.35,
      week52NearHigh DECIMAL(4,2) NOT NULL DEFAULT 0.95,
      week52NearLowPoints INT NOT NULL DEFAULT 15,
      week52BelowMidPoints INT NOT NULL DEFAULT 8,
      week52NearHighPoints INT NOT NULL DEFAULT -10,
      pegVeryLow DECIMAL(5,2) NOT NULL DEFAULT 0.80,
      pegModerate DECIMAL(5,2) NOT NULL DEFAULT 1.20,
      pegHigh DECIMAL(5,2) NOT NULL DEFAULT 3.00,
      pegVeryLowPoints INT NOT NULL DEFAULT 12,
      pegModeratePoints INT NOT NULL DEFAULT 5,
      pegHighPoints INT NOT NULL DEFAULT -8,
      buyTriggerScore INT NOT NULL DEFAULT 75,
      sellTriggerScore INT NOT NULL DEFAULT 25,
      buyPreviousScoreThreshold INT NOT NULL DEFAULT 70,
      sellPreviousScoreThreshold INT NOT NULL DEFAULT 35,
      scoreChangeTrigger INT NOT NULL DEFAULT 10,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      updatedBy VARCHAR(64)
    )
  `;
  
  await conn.execute(sql);
  console.log('alertConfig table created successfully');
  
  // Insert default row
  await conn.execute(`
    INSERT IGNORE INTO alertConfig (id) VALUES (1)
  `);
  console.log('Default alertConfig row inserted');
  
  await conn.end();
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
