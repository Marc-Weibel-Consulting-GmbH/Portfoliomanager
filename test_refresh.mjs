import { fetchEODHDFundamentals } from './server/_core/eodhdApi.ts';

// Test safeFormat function
const safeFormat = (value) => {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num) || !isFinite(num)) return null;
  return num.toFixed(2);
};

// Test cases
console.log('Testing safeFormat:');
console.log('Valid number:', safeFormat(123.456));
console.log('String number:', safeFormat("123.456"));
console.log('NaN:', safeFormat(NaN));
console.log('Infinity:', safeFormat(Infinity));
console.log('null:', safeFormat(null));
console.log('undefined:', safeFormat(undefined));
console.log('Invalid string:', safeFormat("abc"));

// Test EODHD API for ETF
console.log('\nTesting EODHD API for SPY.US:');
try {
  const fundamentals = await fetchEODHDFundamentals('SPY.US');
  console.log('Dividend Yield:', fundamentals.dividendYield);
  console.log('PE Ratio:', fundamentals.peRatio);
  console.log('PEG Ratio:', fundamentals.pegRatio);
  console.log('Beta:', fundamentals.beta);
  
  // Test formatting
  console.log('\nFormatted values:');
  console.log('Dividend Yield:', safeFormat(fundamentals.dividendYield));
  console.log('PE Ratio:', safeFormat(fundamentals.peRatio));
  console.log('PEG Ratio:', safeFormat(fundamentals.pegRatio));
  console.log('Beta:', safeFormat(fundamentals.beta));
} catch (e) {
  console.error('Error:', e.message);
}
