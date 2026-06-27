const key = process.env.EODHD_API_KEY;
if (!key) { console.error("No EODHD_API_KEY"); process.exit(1); }

// Test real-time index data for SMI, S&P 500, MSCI World
const tickers = [
  { name: 'SMI', ticker: 'SSMI.INDX' },
  { name: 'S&P 500', ticker: 'GSPC.INDX' },
  { name: 'MSCI World (URTH)', ticker: 'URTH.US' },
  { name: 'Gold (GLD)', ticker: 'GLD.US' },
];

for (const { name, ticker } of tickers) {
  try {
    const url = `https://eodhd.com/api/real-time/${ticker}?api_token=${key}&fmt=json`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(`${name} (${ticker}): close=${data.close}, open=${data.open}, change=${data.change_p}%`);
  } catch (e) {
    console.error(`${name}: ERROR - ${e.message}`);
  }
}
