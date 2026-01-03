/**
 * Logo Service with Clearbit + FMP Fallback Strategy
 * 
 * Priority:
 * 1. Clearbit (domain-based, high quality)
 * 2. FMP (ticker-based, reliable for stocks)
 * 3. Generic SVG (ticker initials, always works)
 */

import { ENV } from "./_core/env";

interface LogoResult {
  url: string;
  source: "clearbit" | "fmp" | "generic";
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
 * Try to fetch logo from Clearbit
 * Requires company domain (e.g., "nestle.com")
 */
async function fetchClearbitLogo(domain: string): Promise<string | null> {
  try {
    const url = `https://logo.clearbit.com/${domain}`;
    const response = await fetch(url, {
      method: "HEAD", // Just check if logo exists
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    if (response.ok) {
      return url;
    }
    return null;
  } catch (error) {
    console.warn(`[LogoService] Clearbit fetch failed for ${domain}:`, error);
    return null;
  }
}

/**
 * Try to fetch logo from FMP (Financial Modeling Prep)
 */
async function fetchFMPLogo(ticker: string): Promise<string | null> {
  try {
    const apiKey = ENV.fmpApiKey;
    if (!apiKey) {
      console.warn("[LogoService] FMP API key not configured");
      return null;
    }
    
    // FMP profile endpoint includes logo
    const url = `https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${apiKey}`;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0 && data[0].image) {
      return data[0].image;
    }
    
    return null;
  } catch (error) {
    console.warn(`[LogoService] FMP fetch failed for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch logo with automatic fallback chain
 * 
 * @param ticker Stock ticker symbol (e.g., "NESN.SW", "AAPL")
 * @param domain Optional company domain for Clearbit (e.g., "nestle.com")
 * @returns Logo URL and source
 */
export async function fetchLogo(
  ticker: string,
  domain?: string
): Promise<LogoResult> {
  // Clean ticker (remove exchange suffix for FMP)
  const cleanTicker = ticker.split(".")[0];
  
  // Try Clearbit first if domain is provided
  if (domain) {
    const clearbitUrl = await fetchClearbitLogo(domain);
    if (clearbitUrl) {
      console.log(`[LogoService] ✓ Clearbit logo found for ${ticker} (${domain})`);
      return { url: clearbitUrl, source: "clearbit" };
    }
  }
  
  // Try FMP as fallback
  const fmpUrl = await fetchFMPLogo(cleanTicker);
  if (fmpUrl) {
    console.log(`[LogoService] ✓ FMP logo found for ${ticker}`);
    return { url: fmpUrl, source: "fmp" };
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
 * This is a helper to map Swiss tickers to their company domains
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
