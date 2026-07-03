import { drizzle } from 'drizzle-orm/mysql2';

const db = drizzle(process.env.DATABASE_URL);

// Fetch transactions
const txResult = await db.execute(`
  SELECT id, ticker, shares, pricePerShare, totalAmount, currency, fxRate, totalAmountCHF
  FROM portfolioTransactions
  WHERE portfolioId = 90001 AND transactionType = 'buy'
  ORDER BY id
`);

console.log('Current transactions with FX rates:');
console.log('=====================================\n');

let oldTotal = 0;
let newTotal = 0;

for (const tx of txResult[0]) {
  const shares = parseFloat(tx.shares);
  const price = parseFloat(tx.pricePerShare);
  const amount = parseFloat(tx.totalAmount);
  const oldFxRate = parseFloat(tx.fxRate || '1');
  const oldCHF = parseFloat(tx.totalAmountCHF || '0');
  
  // Fetch correct FX rate for 29.10.2025
  let correctFxRate = 1.0;
  if (tx.currency === 'USD') {
    correctFxRate = 0.8800; // Will be fetched from API
  } else if (tx.currency === 'EUR') {
    correctFxRate = 0.9300; // Will be fetched from API
  } else if (tx.currency === 'CHF') {
    correctFxRate = 1.0;
  }
  
  const newCHF = amount * correctFxRate;
  
  oldTotal += oldCHF;
  newTotal += newCHF;
  
  console.log(`${tx.ticker}:`);
  console.log(`  ${shares} @ ${price} ${tx.currency} = ${amount} ${tx.currency}`);
  console.log(`  Old FX: ${oldFxRate} → CHF ${oldCHF.toFixed(2)}`);
  console.log(`  New FX: ${correctFxRate} → CHF ${newCHF.toFixed(2)}`);
  console.log(`  Difference: CHF ${(newCHF - oldCHF).toFixed(2)}\n`);
}

console.log('=====================================');
console.log(`Old Total: CHF ${oldTotal.toFixed(2)}`);
console.log(`New Total: CHF ${newTotal.toFixed(2)}`);
console.log(`Difference: CHF ${(newTotal - oldTotal).toFixed(2)}`);
console.log(`\nTarget: CHF 44'174.00`);
console.log(`Still missing: CHF ${(44174 - newTotal).toFixed(2)}`);
