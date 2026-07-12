/**
 * Test EODHD API directly for the 12 failing tickers
 * and find the correct symbol format
 */
import * as dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.EODHD_API_KEY;
if (!API_KEY) {
  console.error('EODHD_API_KEY not set');
  process.exit(1);
}

// The 12 failing tickers and alternative symbols to try
const TICKERS_TO_TEST = [
  // Original ticker → alternatives to try
  { original: 'IOS.DE', alternatives: ['IOS.DE', 'IOS.XETRA', 'IOS.F'] },
  { original: 'ALV.DE', alternatives: ['ALV.DE', 'ALV.XETRA', 'ALV.F'] },
  { original: 'BAYN.DE', alternatives: ['BAYN.DE', 'BAYN.XETRA', 'BAYN.F'] },
  { original: 'DWS.DE', alternatives: ['DWS.DE', 'DWS.XETRA', 'DWS.F'] },
  { original: 'MUV2.DE', alternatives: ['MUV2.DE', 'MUV2.XETRA', 'MUV2.F'] },
  { original: 'PCZ.DE', alternatives: ['PCZ.DE', 'PCZ.XETRA', 'PCZ.F'] },
  { original: 'PRY.MI', alternatives: ['PRY.MI', 'PRY.MIL', 'PRY.MILAN'] },
  { original: 'SRG.MI', alternatives: ['SRG.MI', 'SRG.MIL', 'SRG.MILAN'] },
  { original: '6856.T', alternatives: ['6856.T', '6856.TSE', '6856.JP'] },
  { original: '7735.T', alternatives: ['7735.T', '7735.TSE', '7735.JP'] },
  { original: '9962.T', alternatives: ['9962.T', '9962.TSE', '9962.JP'] },
  { original: 'D05.SI', alternatives: ['D05.SI', 'D05.SG', 'DBS.SG', 'D05.SGX'] },
];

async function testTicker(symbol) {
  try {
    // Use the real-time endpoint
    const url = `https://eodhd.com/api/real-time/${symbol}?api_token=${API_KEY}&fmt=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return { symbol, status: resp.status, ok: false };
    const data = await resp.json();
    // Check if we got a valid price
    const hasPrice = data && (data.close > 0 || data.previousClose > 0);
    return { symbol, status: resp.status, ok: hasPrice, close: data?.close, previousClose: data?.previousClose };
  } catch (e) {
    return { symbol, status: 0, ok: false, error: e.message };
  }
}

// Also try EODHD search API to find the correct symbol
async function searchTicker(query) {
  try {
    const url = `https://eodhd.com/api/search/${encodeURIComponent(query)}?api_token=${API_KEY}&limit=3&fmt=json`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.slice(0, 3).map(d => ({ code: d.Code, exchange: d.Exchange, name: d.Name, type: d.Type }));
  } catch (e) {
    return [];
  }
}

const results = {};

for (const { original, alternatives } of TICKERS_TO_TEST) {
  console.log(`\n=== Testing ${original} ===`);
  
  let found = null;
  
  // Test all alternatives
  for (const alt of alternatives) {
    const result = await testTicker(alt);
    console.log(`  ${alt}: ${result.ok ? `✓ close=${result.close}` : `✗ (${result.status})`}`);
    if (result.ok && !found) {
      found = alt;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  
  // If none found, try search
  if (!found) {
    console.log(`  → Searching EODHD for "${original}"...`);
    const searchResults = await searchTicker(original.split('.')[0]);
    if (searchResults.length > 0) {
      console.log(`  Search results:`);
      searchResults.forEach(r => console.log(`    ${r.code}.${r.exchange} - ${r.name}`));
    }
  }
  
  results[original] = { found, alternatives };
  await new Promise(r => setTimeout(r, 300));
}

console.log('\n\n=== SUMMARY ===');
for (const [original, { found }] of Object.entries(results)) {
  if (found && found !== original) {
    console.log(`CORRECTION NEEDED: ${original} → ${found}`);
  } else if (found) {
    console.log(`OK: ${original} (already correct)`);
  } else {
    console.log(`NOT FOUND: ${original} (no working EODHD symbol found)`);
  }
}
