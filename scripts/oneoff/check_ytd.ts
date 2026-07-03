import { getAllStocks } from './server/db';

async function main() {
  const stocks = await getAllStocks();
  console.log('Sample stocks with YTD data:');
  const sample = stocks.slice(0, 20);
  sample.forEach(s => {
    const ytdStart = parseFloat(s.ytdStartPrice || '0');
    const current = parseFloat(s.currentPrice || '0');
    const storedYTD = parseFloat(s.ytdPerformance || '0');
    const calculatedYTD = ytdStart > 0 ? ((current - ytdStart) / ytdStart * 100) : 0;
    const diff = Math.abs(storedYTD - calculatedYTD);
    const status = diff > 1 ? '❌ MISMATCH' : '✓';
    console.log(`${status} ${s.ticker}: Start: ${ytdStart.toFixed(2)}, Current: ${current.toFixed(2)}, Stored: ${storedYTD.toFixed(2)}%, Calc: ${calculatedYTD.toFixed(2)}%`);
  });
}

main().catch(console.error);
