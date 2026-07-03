import 'dotenv/config';

const FISCAL_API_KEY = process.env.FISCAL_API_KEY;

console.log(`Testing Fiscal.ai API with key: ${FISCAL_API_KEY?.substring(0, 20)}...`);
console.log(`Key length: ${FISCAL_API_KEY?.length}`);

// Test 1: Get ratios list
console.log('\n=== Test 1: Ratios List ===');
const ratiosResponse = await fetch(`https://api.fiscal.ai/v1/ratios-list?apiKey=${FISCAL_API_KEY}`);
const ratios = await ratiosResponse.json();
console.log(`Status: ${ratiosResponse.status}`);
if (ratios.errors) {
  console.log('Errors:', ratios.errors);
} else {
  console.log(`Found ${ratios.length} ratios`);
  const peRatios = ratios.filter(r => r.ratioId.includes('price_to_earnings'));
  console.log('P/E related ratios:', peRatios.map(r => r.ratioId));
}

// Test 2: Get Meta P/E data
console.log('\n=== Test 2: Meta P/E Historical Data ===');
const metaPEResponse = await fetch(`https://api.fiscal.ai/v1/company/ratios/daily/ratio_price_to_earnings?ticker=META&apiKey=${FISCAL_API_KEY}`);
const metaPE = await metaPEResponse.json();
console.log(`Status: ${metaPEResponse.status}`);
if (metaPE.errors) {
  console.log('Errors:', metaPE.errors);
} else {
  console.log(`Got ${metaPE.length} data points`);
  console.log('Sample data (last 5):', metaPE.slice(-5));
}

// Test 3: Get NVIDIA P/E data
console.log('\n=== Test 3: NVIDIA P/E Historical Data ===');
const nvdaPEResponse = await fetch(`https://api.fiscal.ai/v1/company/ratios/daily/ratio_price_to_earnings?ticker=NVDA&apiKey=${FISCAL_API_KEY}`);
const nvdaPE = await nvdaPEResponse.json();
console.log(`Status: ${nvdaPEResponse.status}`);
if (nvdaPE.errors) {
  console.log('Errors:', nvdaPE.errors);
} else {
  console.log(`Got ${nvdaPE.length} data points`);
  console.log('Sample data (last 5):', nvdaPE.slice(-5));
}
