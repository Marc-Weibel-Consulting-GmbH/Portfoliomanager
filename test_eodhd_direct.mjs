const apiKey = '69050748c713d5.30519552';
const ticker = 'NESN.SW';

console.log(`Testing EODHD API for ${ticker}...`);

try {
  const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    console.error(`API request failed: ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  
  const data = await response.json();
  
  console.log('Success! Response keys:', Object.keys(data));
  
  if (data.Highlights) {
    console.log('Highlights:', {
      PEGRatio: data.Highlights.PEGRatio,
      PERatio: data.Highlights.PERatio,
      DividendYield: data.Highlights.DividendYield,
      MarketCap: data.Highlights.MarketCapitalization,
      Beta: data.Highlights.Beta,
    });
  }
} catch (error) {
  console.error('Error:', error.message);
}
