/**
 * Logo Service with Multi-Provider Fallback Strategy
 * 
 * Priority:
 * 1. EODHD Fundamentals API (all exchanges, requires API key)
 * 2. Finnhub (US stocks only, high quality)
 * 3. Generic SVG (ticker initials, always works)
 */

import { ENV } from "./_core/env";

interface LogoResult {
  url: string;
  source: "eodhd" | "finnhub" | "generic";
}

/**
 * Generate a generic SVG logo with ticker initials
 */
function generateGenericLogo(ticker: string): string {
  const initials = ticker.slice(0, 2).toUpperCase();
  const colors = [
    "#3B82F6", // blue
    "#8B5CF6", // purple
    "#EC4899", // pink
    "#10B981", // green
    "#F59E0B", // amber
    "#EF4444", // red
    "#06B6D4", // cyan
  ];
  
  // Use ticker's first character to deterministically select a color
  const colorIndex = ticker.charCodeAt(0) % colors.length;
  const bgColor = colors[colorIndex];
  
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="${bgColor}" rx="12"/>
    <text x="50" y="50" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text>
  </svg>`;
  
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/**
 * Try to fetch logo from EODHD Fundamentals API
 * This works for all exchanges including Swiss stocks
 */
async function fetchEODHDLogo(ticker: string): Promise<string | null> {
  try {
    const apiKey = ENV.eodhdApiKey;
    if (!apiKey) {
      console.warn("[LogoService] EODHD API key not configured");
      return null;
    }
    
    // EODHD Fundamentals endpoint includes LogoURL
    const url = `https://eodhd.com/api/fundamentals/${ticker}?api_token=${apiKey}&fmt=json&filter=General::LogoURL`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    // When using filter, EODHD returns the value directly as a string
    if (typeof data === 'string' && data.startsWith('/img/logos/')) {
      return `https://eodhd.com${data}`;
    }
    // Fallback for full response format
    if (data && data.General && data.General.LogoURL) {
      const logoPath = data.General.LogoURL;
      return `https://eodhd.com${logoPath}`;
    }
    
    return null;
  } catch (error) {
    console.warn(`[LogoService] EODHD fetch failed for ${ticker}:`, error);
    return null;
  }
}

/**
 * Try to fetch logo from Finnhub (US stocks only)
 */
async function fetchFinnhubLogo(ticker: string): Promise<string | null> {
  try {
    const apiKey = ENV.finnhubApiKey;
    if (!apiKey) {
      console.warn("[LogoService] Finnhub API key not configured");
      return null;
    }
    
    // Finnhub profile endpoint includes logo
    const url = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${apiKey}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data && data.logo) {
      return data.logo;
    }
    
    return null;
  } catch (error) {
    console.warn(`[LogoService] Finnhub fetch failed for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch logo with automatic fallback chain
 * 
 * @param ticker Stock ticker symbol (e.g., "NESN.SW", "AAPL")
 * @param domain Optional company domain (not used anymore, kept for backward compatibility)
 * @returns Logo URL and source
 */
export async function fetchLogo(
  ticker: string,
  domain?: string
): Promise<LogoResult> {
  // Clean ticker (remove exchange suffix for some APIs)
  const cleanTicker = ticker.split(".")[0];
  
  // Try EODHD first (works for all exchanges including Swiss stocks)
  const eodhd = await fetchEODHDLogo(ticker);
  if (eodhd) {
    console.log(`[LogoService] ✓ EODHD logo found for ${ticker}`);
    return { url: eodhd, source: "eodhd" };
  }
  
  // Try Finnhub as fallback (US stocks only)
  const finnhubUrl = await fetchFinnhubLogo(cleanTicker);
  if (finnhubUrl) {
    console.log(`[LogoService] ✓ Finnhub logo found for ${ticker}`);
    return { url: finnhubUrl, source: "finnhub" };
  }
  
  // Generate generic SVG as last resort
  console.log(`[LogoService] ⚠ Using generic logo for ${ticker}`);
  const genericUrl = generateGenericLogo(cleanTicker);
  return { url: genericUrl, source: "generic" };
}

/**
 * Batch fetch logos for multiple tickers
 * Useful for portfolio views with many stocks
 */
export async function fetchLogoBatch(
  items: Array<{ ticker: string; domain?: string }>
): Promise<Map<string, LogoResult>> {
  const results = new Map<string, LogoResult>();
  
  // Process in parallel with Promise.all
  await Promise.all(
    items.map(async (item) => {
      const result = await fetchLogo(item.ticker, item.domain);
      results.set(item.ticker, result);
    })
  );
  
  return results;
}

/**
 * Get company domain from ticker (Swiss stocks mapping)
 * This is kept for backward compatibility but not used anymore
 * @deprecated Use EODHD Fundamentals API instead
 */
export function getSwissStockDomain(ticker: string): string | undefined {
  const domainMap: Record<string, string> = {
    // SMI Index (Top 20 Swiss stocks)
    "NESN.SW": "nestle.com",
    "NOVN.SW": "novartis.com",
    "ROG.SW": "roche.com",
    "UBSG.SW": "ubs.com",
    "ZURN.SW": "zurich.com",
    "ABBN.SW": "abb.com",
    "SREN.SW": "swissre.com",
    "CSGN.SW": "credit-suisse.com",
    "LONN.SW": "lonza.com",
    "GIVN.SW": "givaudan.com",
    "SLHN.SW": "swisslife.com",
    "BAER.SW": "juliusbaer.com",
    "SIKA.SW": "sika.com",
    "GEBN.SW": "geberit.com",
    "SCMN.SW": "swisscom.com",
    "PGHN.SW": "partners-group.com",
    "ALC.SW": "alcon.com",
    "STMN.SW": "straumann.com",
    "SGSN.SW": "sgs.com",
    "KNIN.SW": "kuehne-nagel.com",
    
    // Additional major Swiss companies
    "HOLN.SW": "holcim.com",
    "LISN.SW": "lindt.com",
    "BUCN.SW": "bucher.ch",
    "SCHP.SW": "schindler.com",
    "VATN.SW": "vat.ch",
    "TEMN.SW": "temenos.com",
    "ADEN.SW": "adecco.com",
    "SOON.SW": "sonova.com",
    "SYNN.SW": "syngenta.com",
    "BEAN.SW": "barry-callebaut.com",
    "DKSH.SW": "dksh.com",
    "EFGN.SW": "efginternational.com",
    "FHZN.SW": "flughafen-zuerich.ch",
    "GALE.SW": "galenica.com",
    "HELN.SW": "helvetia.com",
    "KURN.SW": "kur.ch",
    "MBTN.SW": "mbt.com",
    "OERL.SW": "oerlikon.com",
    "PSPN.SW": "psp.info",
    "SAHN.SW": "swissquote.ch",
    "SIGN.SW": "sig.biz",
    "SPSN.SW": "swissports.com",
    "SRCG.SW": "srg-ssr.ch",
    "UHRN.SW": "swatchgroup.com",
    "VNA.SW": "vonovia.de",
    "WARN.SW": "wartsila.com",
    "WIHN.SW": "wienerberger.com",
    
    // Banks & Financial Services
    "BANB.SW": "bankinter.com",
    "BBZA.SW": "bbva.com",
    "BEKN.SW": "bekb.ch",
    "BSKP.SW": "basler.ch",
    "VPBN.SW": "vp-bank.com",
    
    // Insurance
    "BALZ.SW": "baloise.com",
    "MOBN.SW": "mobiliar.ch",
    
    // Industrial & Manufacturing
    "BARN.SW": "barry-callebaut.com",
    "CMBN.SW": "cmb.ch",
    "FORN.SW": "forbo.com",
    "RIEN.SW": "rieter.com",
    "SFZN.SW": "sfz.ch",
  };
  
  return domainMap[ticker.toUpperCase()];
}
