// Test direct import
import { fetchStockMetrics } from './server/_core/stockDataApi.ts';
import { fetchEODHDFundamentals } from './server/_core/eodhdApi.ts';

console.log('✅ Imports successful!');
console.log('fetchStockMetrics:', typeof fetchStockMetrics);
console.log('fetchEODHDFundamentals:', typeof fetchEODHDFundamentals);
