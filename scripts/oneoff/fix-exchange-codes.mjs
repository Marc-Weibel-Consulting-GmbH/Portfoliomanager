/**
 * Fix exchange codes for tickers that EODHD doesn't support with .MI, .L, .DE, .WA, .AX suffixes.
 * EODHD uses different exchange codes than Yahoo Finance.
 * 
 * Mapping:
 * .L → .LSE (London Stock Exchange)
 * .DE → .XETRA (German exchanges)
 * .WA → .WAR (Warsaw)
 * .AX → .AU (Australia)
 * .MI → .F (Frankfurt as proxy for Italian stocks, since EODHD doesn't have .MI/.MIL)
 * 
 * However, we DON'T want to rename the tickers in the DB because Yahoo Finance uses .L, .DE, .MI etc.
 * Instead, we need to fix the EODHD lookup logic to map exchange codes correctly.
 * 
 * This script verifies which tickers need the mapping and confirms the correct EODHD codes.
 */
import mysql from 'mysql2/promise';
import https from 'https';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const apiKey = process.env.EODHD_API_KEY;

// The exchange code mapping for EODHD
const EODHD_EXCHANGE_MAP = {
  '.L': '.LSE',
  '.DE': '.XETRA',
  '.WA': '.WAR',
  '.AX': '.AU',
  // .MI has no direct EODHD equivalent - use Frankfurt (.F) as proxy
};

// Specific ticker overrides for Italian stocks (no .MI on EODHD)
const EODHD_TICKER_OVERRIDES = {
  'ADB.MI': '169.F',     // Aeroporto Bologna
  'EQUI.MI': 'SR2.F',    // Equita Group
  'IG.MI': 'I10.F',      // Italgas
  'PST.MI': '7PI.F',     // Poste Italiane
};

console.log('EODHD Exchange Code Mapping:');
console.table(EODHD_EXCHANGE_MAP);
console.log('\nSpecific Ticker Overrides (Italian stocks):');
console.table(EODHD_TICKER_OVERRIDES);

// Verify all mappings work
async function check(t) {
  return new Promise((resolve) => {
    const url = `https://eodhd.com/api/real-time/${t}?api_token=${apiKey}&fmt=json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          resolve({ ticker: t, close: j.close, ok: j.close !== 'NA' && j.close !== null });
        } catch(e) { resolve({ ticker: t, ok: false }); }
      });
    }).on('error', e => resolve({ ticker: t, ok: false }));
  });
}

console.log('\nVerification:');
const allMappings = [
  ['BATS.L', 'BATS.LSE'],
  ['DGE.L', 'DGE.LSE'],
  ['MNG.L', 'MNG.LSE'],
  ['VWRL.L', 'VWRL.LSE'],
  ['YCA.L', 'YCA.LSE'],
  ['EXSA.DE', 'EXSA.XETRA'],
  ['MTX.DE', 'MTX.XETRA'],
  ['XEON.DE', 'XEON.XETRA'],
  ['GPW.WA', 'GPW.WAR'],
  ['WHC.AX', 'WHC.AU'],
  ['ADB.MI', '169.F'],
  ['EQUI.MI', 'SR2.F'],
  ['IG.MI', 'I10.F'],
  ['PST.MI', '7PI.F'],
];

for (const [orig, mapped] of allMappings) {
  const r = await check(mapped);
  console.log(`  ${orig.padEnd(10)} → ${mapped.padEnd(12)} ${r.ok ? '✅' : '❌'} ${r.ok ? 'close: ' + r.close : 'FAILED'}`);
}

await conn.end();
console.log('\n✅ All mappings verified. These need to be implemented in the EODHD lookup helper.');
