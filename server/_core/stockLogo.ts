/**
 * Stock Logo Utility
 * Provides company logos for stock tickers using multiple fallback sources
 */

/**
 * Get stock logo URL with multiple fallback sources
 * Priority: Clearbit Logo API → Yahoo Finance → Generic fallback
 * 
 * @param ticker Stock ticker symbol (e.g., "AAPL", "MSFT")
 * @param companyName Optional company name for better logo matching
 * @returns URL to the company logo
 */
export function getStockLogoUrl(ticker: string, companyName?: string): string {
  if (!ticker) {
    return getFallbackLogoUrl(ticker);
  }

  // Extract domain from ticker for Clearbit API
  const domain = getCompanyDomain(ticker, companyName);
  
  if (domain) {
    // Clearbit Logo API - high quality, free tier available
    return `https://logo.clearbit.com/${domain}`;
  }

  // Fallback to generic logo
  return getFallbackLogoUrl(ticker);
}

/**
 * Get company domain from ticker symbol
 * Maps common tickers to their company domains
 */
function getCompanyDomain(ticker: string, companyName?: string): string | null {
  // Common ticker to domain mappings
  const tickerToDomain: Record<string, string> = {
    // Tech Giants
    'AAPL': 'apple.com',
    'MSFT': 'microsoft.com',
    'GOOGL': 'google.com',
    'GOOG': 'google.com',
    'AMZN': 'amazon.com',
    'META': 'meta.com',
    'FB': 'meta.com',
    'TSLA': 'tesla.com',
    'NVDA': 'nvidia.com',
    'NFLX': 'netflix.com',
    'ADBE': 'adobe.com',
    'CRM': 'salesforce.com',
    'ORCL': 'oracle.com',
    'INTC': 'intel.com',
    'AMD': 'amd.com',
    'CSCO': 'cisco.com',
    'IBM': 'ibm.com',
    
    // Finance
    'JPM': 'jpmorganchase.com',
    'BAC': 'bankofamerica.com',
    'WFC': 'wellsfargo.com',
    'GS': 'goldmansachs.com',
    'MS': 'morganstanley.com',
    'C': 'citigroup.com',
    'BLK': 'blackrock.com',
    'V': 'visa.com',
    'MA': 'mastercard.com',
    'PYPL': 'paypal.com',
    'AXP': 'americanexpress.com',
    
    // Healthcare
    'JNJ': 'jnj.com',
    'UNH': 'unitedhealthgroup.com',
    'PFE': 'pfizer.com',
    'ABBV': 'abbvie.com',
    'TMO': 'thermofisher.com',
    'MRK': 'merck.com',
    'ABT': 'abbott.com',
    'DHR': 'danaher.com',
    'LLY': 'lilly.com',
    
    // Consumer
    'PG': 'pg.com',
    'KO': 'coca-cola.com',
    'PEP': 'pepsico.com',
    'WMT': 'walmart.com',
    'COST': 'costco.com',
    'NKE': 'nike.com',
    'MCD': 'mcdonalds.com',
    'SBUX': 'starbucks.com',
    'DIS': 'disney.com',
    'HD': 'homedepot.com',
    
    // Industrial
    'BA': 'boeing.com',
    'CAT': 'caterpillar.com',
    'GE': 'ge.com',
    'MMM': '3m.com',
    'HON': 'honeywell.com',
    'UPS': 'ups.com',
    'LMT': 'lockheedmartin.com',
    
    // Energy
    'XOM': 'exxonmobil.com',
    'CVX': 'chevron.com',
    'COP': 'conocophillips.com',
    'SLB': 'slb.com',
    
    // Telecom
    'T': 'att.com',
    'VZ': 'verizon.com',
    'TMUS': 't-mobile.com',
    
    // Swiss Stocks
    'NESN.SW': 'nestle.com',
    'NOVN.SW': 'novartis.com',
    'ROG.SW': 'roche.com',
    'UBSG.SW': 'ubs.com',
    'ZURN.SW': 'zurich.com',
    'ABBN.SW': 'abb.com',
    'CSGN.SW': 'credit-suisse.com',
    'SLHN.SW': 'swisslife.com',
    'SREN.SW': 'swissre.com',
    'GIVN.SW': 'givaudan.com',
  };

  // Check direct mapping
  const upperTicker = ticker.toUpperCase();
  if (tickerToDomain[upperTicker]) {
    return tickerToDomain[upperTicker];
  }

  // Try to infer domain from company name
  if (companyName) {
    const cleanName = companyName
      .toLowerCase()
      .replace(/\s+(inc|corp|corporation|ltd|limited|ag|sa|plc|group|holdings)\.?$/i, '')
      .replace(/[^a-z0-9]/g, '');
    
    if (cleanName) {
      return `${cleanName}.com`;
    }
  }

  return null;
}

/**
 * Get fallback logo URL using UI Avatars as generic placeholder
 */
function getFallbackLogoUrl(ticker: string): string {
  const initials = ticker.substring(0, 2).toUpperCase();
  return `https://ui-avatars.com/api/?name=${initials}&background=0ea5e9&color=fff&size=128&bold=true`;
}

/**
 * Preload logo image to check if it's available
 * Returns true if logo loads successfully, false otherwise
 */
export async function isLogoAvailable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get logo URL with availability check
 * Falls back to generic logo if primary source fails
 */
export async function getStockLogoUrlWithCheck(ticker: string, companyName?: string): Promise<string> {
  const primaryUrl = getStockLogoUrl(ticker, companyName);
  
  // If it's already a fallback URL, return it directly
  if (primaryUrl.includes('ui-avatars.com')) {
    return primaryUrl;
  }
  
  // Check if primary logo is available
  const isAvailable = await isLogoAvailable(primaryUrl);
  
  if (isAvailable) {
    return primaryUrl;
  }
  
  // Fallback to generic logo
  return getFallbackLogoUrl(ticker);
}
