import mysql from 'mysql2/promise';
import fs from 'fs';

const stocksData = JSON.parse(fs.readFileSync('/home/ubuntu/stock_descriptions.json', 'utf8'));

async function importMoats() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Importing moats for stocks...');
    console.log('='.repeat(80));
    
    let updated = 0;
    let notFound = 0;
    
    for (const [ticker, data] of Object.entries(stocksData)) {
      const moats = data.moats;
      
      if (moats.length >= 3) {
        const [result] = await conn.query(
          'UPDATE stocks SET moat1 = ?, moat2 = ?, moat3 = ? WHERE ticker = ?',
          [moats[0], moats[1], moats[2], ticker]
        );
        
        if (result.affectedRows > 0) {
          console.log(`✓ ${ticker.padEnd(15)} - ${data.company}`);
          updated++;
        } else {
          console.log(`✗ ${ticker.padEnd(15)} - NOT FOUND IN DATABASE`);
          notFound++;
        }
      }
    }
    
    console.log('='.repeat(80));
    console.log(`\nCompleted: ${updated} updated, ${notFound} not found`);
    
  } finally {
    await conn.end();
  }
}

importMoats().catch(console.error);
