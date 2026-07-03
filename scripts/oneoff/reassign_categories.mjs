import mysql from 'mysql2/promise';

// Map stocks from "Andere" to specific sectors
const categoryMapping = {
  // Technology
  "AMD": "Technologie",
  "DELL": "Technologie",
  "NET": "Technologie",
  "TRMB": "Technologie",
  "APP": "Technologie",
  
  // E-Commerce & Internet
  "AMZN": "E-Commerce",
  "MELI": "E-Commerce",
  
  // Automotive
  "TSLA": "Automotive",
  
  // Healthcare & Biotech
  "NOVO-B.CO": "Healthcare",
  "NTLA": "Biotech",
  "RMD": "Healthcare",
  "MOH": "Healthcare",
  "STMN.SW": "Healthcare",
  "GALD.SW": "Healthcare",
  "TEM": "Healthcare",
  "HIMS": "Healthcare",
  
  // Energy & Utilities
  "EOSE": "Energie",
  "BE": "Energie",
  "VST": "Energie",
  "IREN": "Energie",
  "CIFR": "Energie",
  
  // Financial Services
  "V": "Finanzdienstleistungen",
  "BRK-B": "Finanzdienstleistungen",
  "SOFI": "Finanzdienstleistungen",
  
  // Infrastructure & Industrials
  "FHZN.SW": "Infrastruktur",
  "CSL": "Industrie",
  "AXON": "Industrie",
  
  // Consumer & Retail
  "LISN.SW": "Konsumgüter",
  
  // Commodities & Materials
  "REMX": "Rohstoffe"
};

async function reassignCategories() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    console.log('Reassigning categories from "Andere" to specific sectors...');
    console.log('='.repeat(80));
    
    let updated = 0;
    
    for (const [ticker, newCategory] of Object.entries(categoryMapping)) {
      const [result] = await conn.query(
        'UPDATE stocks SET category = ? WHERE ticker = ?',
        [newCategory, ticker]
      );
      
      if (result.affectedRows > 0) {
        console.log(`✓ ${ticker.padEnd(15)} → ${newCategory}`);
        updated++;
      } else {
        console.log(`✗ ${ticker.padEnd(15)} - NOT FOUND`);
      }
    }
    
    console.log('='.repeat(80));
    console.log(`\nCompleted: ${updated} stocks reassigned to specific sectors`);
    
    // Check remaining "Andere"
    const [remaining] = await conn.query('SELECT COUNT(*) as count FROM stocks WHERE category = "Andere"');
    console.log(`Remaining "Andere": ${remaining[0].count} stocks`);
    
  } finally {
    await conn.end();
  }
}

reassignCategories().catch(console.error);
