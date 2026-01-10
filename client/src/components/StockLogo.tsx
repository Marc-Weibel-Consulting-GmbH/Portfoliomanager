import { useState, useEffect } from 'react';

interface StockLogoProps {
  ticker: string;
  companyName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Tickers that get wrong logos from FinancialModelingPrep - skip to Clearbit
const FMP_LOGO_BLACKLIST = new Set(['GIVN.SW', 'GIVN', 'GF.SW', 'GF']);

// Swiss company domain mapping for known companies
const SWISS_DOMAIN_MAP: Record<string, string> = {
  'St Galler Kantonalbank': 'sgkb.ch',
  'Zurich Insurance Group': 'zurich.com',
  'Swiss Re AG': 'swissre.com',
  'Swiss Life Holding': 'swisslife.com',
  'Swisscom AG': 'swisscom.ch',
  'Kuehne + Nagel International AG': 'kuehne-nagel.com',
  'Kühne + Nagel International AG': 'kuehne-nagel.com',
  'Kuehne & Nagel': 'kuehne-nagel.com',
  'Kuehne & Nagel Int': 'kuehne-nagel.com',
  'Kühne & Nagel': 'kuehne-nagel.com',
  'Straumann Holding': 'straumann.com',
  'Galderma Group A': 'galderma.com',
  'Flughafen Zurich A': 'zurich-airport.com',
  'Galenica AG': 'galenica.com',
  'Holcim AG': 'holcim.com',
  'BKW AG': 'bkw.ch',
  'Cembra Money Bank': 'cembra.ch',
  'Swissquote Group': 'swissquote.com',
  'Chocoladefabriken Lindt & Spruengli AG': 'lindt.com',
  'Logitech International SA': 'logitech.com',
  'Mesa Air Group': 'mesa-air.com',
  'Nestle SA': 'nestle.com',
  'Sika AG': 'sika.com',
  'Givaudan SA': 'givaudan.com',
  'Givaudan AG': 'givaudan.com',
  'Givaudan': 'givaudan.com',
  'Georg Fischer AG': 'georgfischer.com',
  'Georg Fischer': 'georgfischer.com',
  'GF': 'georgfischer.com',
  'ABB': 'abb.com',
  'ABB Ltd': 'abb.com',
  'Julius Baer Gruppe AG': 'juliusbaer.com',
  'Julius Baer Group': 'juliusbaer.com',
  'Julius Baer': 'juliusbaer.com',
  'VP Bank AG': 'vpbank.com',
  'VP Bank': 'vpbank.com',
  'EFG International AG': 'efginternational.com',
  'EFG International': 'efginternational.com',
  'EFG': 'efginternational.com',
};

/**
 * Extract clean domain from company name
 */
function extractDomain(companyName: string): string {
  if (!companyName) return '';
  return companyName.toLowerCase()
    .replace(/\s+(inc|corp|corporation|ltd|limited|ag|sa|spa|nv|group|holding|holdings|technologies|technology|enterprise|enterprises|healthcare|health|energy|networks|network|semiconductor|semiconductors|therapeutics|platforms|platform|solutions|solution|international|global|systems|services|bank|bancorp|financial|kantonalbank).*$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Centralized stock logo component with consistent fallback chain:
 * 1. EODHD (40k+ logos, no API key needed, direct URL)
 * 2. FinancialModelingPrep API (free, high quality)
 * 3. Clearbit with known domain mapping (Swiss companies)
 * 4. Clearbit with extracted domain (.ch for Swiss, .com for others)
 * 5. Clearbit with alternate domain (.com for Swiss)
 * 6. Logo.dev API
 * 7. Letter avatar (final fallback)
 */
export function StockLogo({ ticker, companyName, size = 'md', className = '' }: StockLogoProps) {
  const [logoError, setLogoError] = useState(false);
  const [fallbackLevel, setFallbackLevel] = useState(0);

  // Size classes
  const sizeClasses = {
    sm: 'w-8 h-8 text-xl',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
  };

  // Handle undefined ticker or companyName
  if (!ticker || !companyName) {
    const initial = (ticker || companyName || '?').charAt(0).toUpperCase();
    return (
      <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold`}>
        {initial}
      </div>
    );
  }

  const isSwissStock = ticker?.endsWith('.SW');
  const knownDomain = SWISS_DOMAIN_MAP[companyName];
  const extractedDomain = extractDomain(companyName);
  const domainExt = isSwissStock ? 'ch' : 'com';



  // Get logo URL based on fallback level
  const getLogoUrl = () => {
    // Level 0: EODHD (primary, fastest)
    if (fallbackLevel === 0) {
      const parts = ticker.split('.');
      const symbol = parts[0].toLowerCase();
      const exchange = parts.length === 2 ? parts[1].toUpperCase() : 'US';
      return `https://eodhd.com/img/logos/${exchange}/${symbol}.png`;
    }
    
    // Level 1: FinancialModelingPrep - skip if blacklisted
    if (fallbackLevel === 1) {
      if (FMP_LOGO_BLACKLIST.has(ticker)) {
        return null; // Skip to next level
      }
      // Strip all exchange suffixes for FMP (they don't use exchange codes)
      const fmpTicker = ticker.replace(/\.(SW|US|PA|L|TO|NEO|BA|XETRA|MI|CO|DE|AS)$/, '');
      return `https://financialmodelingprep.com/image-stock/${fmpTicker}.png`;
    }
    
    // Level 2: Clearbit with known domain
    if (fallbackLevel === 2 && knownDomain) {
      return `https://logo.clearbit.com/${knownDomain}`;
    }
    
    // Level 3: Clearbit with extracted domain
    if (fallbackLevel === 3) {
      return `https://logo.clearbit.com/${extractedDomain}.${domainExt}`;
    }
    
    // Level 4: Clearbit with alternate domain (.com for Swiss)
    if (fallbackLevel === 4 && isSwissStock) {
      return `https://logo.clearbit.com/${extractedDomain}.com`;
    }
    
    // Level 5: Logo.dev
    if (fallbackLevel === 5) {
      return `https://img.logo.dev/${extractedDomain}.${domainExt}?token=pk_X-WvJHQ4RfGZNwIeHI-52Q&size=120`;
    }
    
    // Level 6+: Show letter avatar
    return null;
  };

  const logoUrl = getLogoUrl();

  // If logoUrl is null (skipped fallback level), move to next level
  useEffect(() => {
    if (!logoUrl && fallbackLevel < 6) {
      setFallbackLevel(prev => prev + 1);
    }
  }, [logoUrl, fallbackLevel]);

  const handleError = () => {
    // Move to next fallback level
    setFallbackLevel(prev => prev + 1);
    
    // If we've exhausted all fallbacks, show letter avatar
    if (fallbackLevel >= 5) {
      setLogoError(true);
    }
  };

  // Show letter avatar ONLY if all fallbacks failed
  if (logoError || fallbackLevel >= 6 || !logoUrl) {
    return (
      <div className={`${sizeClasses[size]} rounded-lg bg-white flex items-center justify-center ${className}`}>
        <div className={`w-full h-full flex items-center justify-center font-bold text-blue-600`}>
          {companyName.charAt(0)}
        </div>
      </div>
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-white p-1 flex items-center justify-center ${className}`}>
      <img
        src={logoUrl}
        alt={companyName}
        className="w-full h-full object-contain"
        onError={handleError}
      />
    </div>
  );
}
