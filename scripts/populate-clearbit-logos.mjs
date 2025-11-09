import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { stocks } from '../drizzle/schema.js';
import { eq } from 'drizzle-orm';

/**
 * Generate Clearbit logo URL for a ticker
 */
function generateClearbitLogoUrl(ticker, companyName) {
  // Remove exchange suffixes
  const cleanTicker = ticker.replace(/\.(US|SW|L|DE)$/, '');
  
  // For well-known companies, use direct domain mapping
  const domainMap = {
    'AAPL': 'apple.com',
    'MSFT': 'microsoft.com',
    'GOOGL': 'google.com',
    'GOOG': 'google.com',
    'AMZN': 'amazon.com',
    'NVDA': 'nvidia.com',
    'META': 'meta.com',
    'TSLA': 'tesla.com',
    'BRK': 'berkshirehathaway.com',
    'V': 'visa.com',
    'JNJ': 'jnj.com',
    'WMT': 'walmart.com',
    'JPM': 'jpmorganchase.com',
    'MA': 'mastercard.com',
    'PG': 'pg.com',
    'UNH': 'unitedhealthgroup.com',
    'HD': 'homedepot.com',
    'DIS': 'disney.com',
    'BAC': 'bankofamerica.com',
    'ADBE': 'adobe.com',
    'CRM': 'salesforce.com',
    'NFLX': 'netflix.com',
    'CSCO': 'cisco.com',
    'PFE': 'pfizer.com',
    'INTC': 'intel.com',
    'AMD': 'amd.com',
    'ORCL': 'oracle.com',
    'IBM': 'ibm.com',
    'QCOM': 'qualcomm.com',
    'PYPL': 'paypal.com',
    'NKE': 'nike.com',
    'COST': 'costco.com',
    'ABT': 'abbott.com',
    'TMO': 'thermofisher.com',
    'MRK': 'merck.com',
    'ABBV': 'abbvie.com',
    'LLY': 'lilly.com',
    'AVGO': 'broadcom.com',
    'TXN': 'ti.com',
    'MDT': 'medtronic.com',
    'UPS': 'ups.com',
    'HON': 'honeywell.com',
    'UNP': 'up.com',
    'LOW': 'lowes.com',
    'BA': 'boeing.com',
    'CAT': 'caterpillar.com',
    'GE': 'ge.com',
    'MMM': '3m.com',
    'SPGI': 'spglobal.com',
    'BLK': 'blackrock.com',
    'AXP': 'americanexpress.com',
    'GS': 'goldmansachs.com',
    'MS': 'morganstanley.com',
    'SCHW': 'schwab.com',
    'CB': 'chubb.com',
    'CI': 'cigna.com',
    'CVS': 'cvs.com',
    'WFC': 'wellsfargo.com',
    'USB': 'usbank.com',
    'PNC': 'pnc.com',
    'TFC': 'truist.com',
    'COF': 'capitalone.com',
    'AIG': 'aig.com',
    'MET': 'metlife.com',
    'PRU': 'prudential.com',
    'ALL': 'allstate.com',
    'TRV': 'travelers.com',
    'PGR': 'progressive.com',
    'HUM': 'humana.com',
    'ANTM': 'antheminc.com',
    'CNC': 'centene.com',
    'WBA': 'walgreens.com',
    'CVX': 'chevron.com',
    'XOM': 'exxonmobil.com',
    'COP': 'conocophillips.com',
    'SLB': 'slb.com',
    'EOG': 'eogresources.com',
    'PXD': 'pxd.com',
    'MPC': 'marathonpetroleum.com',
    'VLO': 'valero.com',
    'PSX': 'phillips66.com',
    'KMI': 'kindermorgan.com',
    'WMB': 'williams.com',
    'OKE': 'oneok.com',
    'LNG': 'cheniere.com',
    'NEE': 'nexteraenergy.com',
    'DUK': 'duke-energy.com',
    'SO': 'southerncompany.com',
    'D': 'dominionenergy.com',
    'AEP': 'aep.com',
    'EXC': 'exeloncorp.com',
    'XEL': 'xcelenergy.com',
    'SRE': 'sempra.com',
    'PEG': 'pseg.com',
    'ED': 'conedison.com',
    'EIX': 'edison.com',
    'WEC': 'wecenergygroup.com',
    'AWK': 'amwater.com',
    'DTE': 'dteenergy.com',
    'ES': 'eversourceenergy.com',
    'FE': 'firstenergycorp.com',
    'AEE': 'ameren.com',
    'CMS': 'cmsenergy.com',
    'CNP': 'centerpointenergy.com',
    'PPL': 'pplweb.com',
    'ETR': 'entergy.com',
    'EVRG': 'evergy.com',
    'LNT': 'alliantenergy.com',
    'ATO': 'atmos.com',
    'NI': 'nisource.com',
    'PNW': 'pinnaclewest.com',
    'NRG': 'nrg.com',
    'NOVN': 'novartis.com',
    'ABBN': 'abb.com',
    'GEBN': 'geberit.com',
    'HELN': 'helvetia.com',
    'SIKA': 'sika.com',
    'LOGN': 'logitech.com',
    'GIVN': 'givaudan.com',
    'KNIN': 'kuhne-nagel.com',
    'BAER': 'juliusbaer.com',
    'GF': 'georgfischer.com',
    'VONN': 'vonovia.com',
    'AUTN': 'autoliv.com',
  };
  
  const domain = domainMap[cleanTicker];
  if (domain) {
    return `https://logo.clearbit.com/${domain}`;
  }
  
  // Fallback: Use company name to guess domain
  if (companyName) {
    const simpleName = companyName
      .toLowerCase()
      .replace(/\s+(inc|corp|corporation|ltd|limited|ag|sa|se|plc|nv|gmbh|co|company|group|holding|holdings)\.?$/i, '')
      .replace(/[^a-z0-9]+/g, '')
      .trim();
    
    if (simpleName) {
      return `https://logo.clearbit.com/${simpleName}.com`;
    }
  }
  
  // Final fallback: Use ticker
  return `https://logo.clearbit.com/${cleanTicker.toLowerCase()}.com`;
}

/**
 * Main function to populate Clearbit logo URLs
 */
async function populateClearbitLogos() {
  console.log('[Clearbit] Starting logo population...');
  
  // Connect to database
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const db = drizzle(connection);
  
  try {
    // Fetch all stocks
    const allStocks = await db.select().from(stocks);
    console.log(`[Clearbit] Found ${allStocks.length} stocks to process`);
    
    let updatedCount = 0;
    
    for (const stock of allStocks) {
      try {
        const logoUrl = generateClearbitLogoUrl(stock.ticker, stock.companyName);
        
        // Update stock
        await db.update(stocks)
          .set({ logoUrl })
          .where(eq(stocks.id, stock.id));
        
        updatedCount++;
        console.log(`[${updatedCount}/${allStocks.length}] ${stock.ticker}: ${logoUrl}`);
        
      } catch (error) {
        console.error(`[Error] Failed to update ${stock.ticker}:`, error.message);
      }
    }
    
    console.log(`\n[Clearbit] Complete!`);
    console.log(`  ✓ Updated: ${updatedCount} stocks`);
    
  } catch (error) {
    console.error('[Clearbit] Fatal error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the script
populateClearbitLogos()
  .then(() => {
    console.log('[Clearbit] Script finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Clearbit] Script failed:', error);
    process.exit(1);
  });
