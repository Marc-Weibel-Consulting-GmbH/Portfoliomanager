const apiKey = process.env.EODHD_API_KEY;
const ticker = 'RO.SW';
const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json`;
console.log('Fetching RO.SW fundamentals...');
const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
console.log('Status:', res.status);
if (res.ok) {
  const d = await res.json();
  const h = d.Highlights || {};
  const v = d.Valuation || {};
  const e = d.Earnings || {};
  console.log('PERatio:', h.PERatio);
  console.log('PEGRatio:', h.PEGRatio);
  console.log('ForwardPE:', v.ForwardPE);
  console.log('EarningsShare:', h.EarningsShare);
  console.log('EPSEstimateNextYear:', h.EPSEstimateNextYear);
  const history = e.History || {};
  const keys = Object.keys(history).sort().slice(-8);
  console.log('EPS History (last 8):', keys.map(k => `${k}:${history[k]?.epsActual}`).join(', '));
  const fin = d.Financials || {};
  const is = fin.Income_Statement?.annual || {};
  const isKeys = Object.keys(is).sort().slice(-3);
  console.log('Revenue (last 3y):', isKeys.map(k => `${k}:${is[k]?.totalRevenue}`).join(', '));
  console.log('NetIncome (last 3y):', isKeys.map(k => `${k}:${is[k]?.netIncome}`).join(', '));
} else {
  const text = await res.text();
  console.log('Error:', text.slice(0, 200));
}
