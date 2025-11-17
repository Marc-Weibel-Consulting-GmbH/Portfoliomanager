import { fetchEODHDFundamentals } from './server/_core/eodhdApi.ts';

const ticker = 'NESN.SW';
console.log(`Testing EODHD API for ${ticker}...`);

try {
  const fundamentals = await fetchEODHDFundamentals(ticker);
  console.log('Success! Fundamentals:', JSON.stringify(fundamentals, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
