const apiKey = '69050748c713d5.30519552';
const ticker = 'NESN.SW';

console.log(`\n🔍 Testing EODHD API for ${ticker}...\n`);

try {
  const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  if (data.Highlights) {
    const h = data.Highlights;
    console.log('✅ EODHD Fundamentals:');
    console.log('   PEG Ratio:', h.PEGRatio || 'N/A');
    console.log('   P/E Ratio:', h.PERatio || 'N/A');
    console.log('   Dividend Yield:', h.DividendYield ? (h.DividendYield * 100).toFixed(2) + '%' : 'N/A');
    console.log('   Market Cap:', h.MarketCapitalization ? (h.MarketCapitalization / 1e9).toFixed(2) + 'B' : 'N/A');
    console.log('   Beta:', h.Beta || 'N/A');
    console.log('\n✅ EODHD API works perfectly!\n');
  } else {
    console.log('❌ No Highlights data found');
  }
} catch (error) {
  console.error('❌ Error:', error.message);
}
