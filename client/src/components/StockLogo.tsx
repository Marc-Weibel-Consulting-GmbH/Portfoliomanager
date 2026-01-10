import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

interface StockLogoProps {
  ticker: string;
  companyName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Size classes
const sizeClasses = {
  sm: 'w-8 h-8 text-xl',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
};

/**
 * Generate a letter avatar as fallback
 */
function LetterAvatar({ letter, size, className }: { letter: string; size: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={`${sizeClasses[size]} rounded-lg bg-white flex items-center justify-center ${className || ''}`}>
      <div className="w-full h-full flex items-center justify-center font-bold text-blue-600">
        {letter}
      </div>
    </div>
  );
}

/**
 * Stock logo component that fetches logos from the backend API
 * The backend uses EODHD Fundamentals API with proper API key authentication
 */
export function StockLogo({ ticker, companyName, size = 'md', className = '' }: StockLogoProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state when ticker changes
  useEffect(() => {
    setImageError(false);
  }, [ticker]);

  // Handle undefined ticker or companyName
  if (!ticker || !companyName) {
    const initial = (ticker || companyName || '?').charAt(0).toUpperCase();
    return (
      <div className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold`}>
        {initial}
      </div>
    );
  }

  // Fetch logo URL from backend
  const { data: logoData, isLoading } = trpc.logos.getLogoUrl.useQuery(
    { ticker, companyName },
    {
      staleTime: 1000 * 60 * 60, // Cache for 1 hour
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    }
  );

  // Show letter avatar while loading
  if (isLoading) {
    return <LetterAvatar letter={companyName.charAt(0)} size={size} className={className} />;
  }

  // Show letter avatar if no logo data or image failed to load
  if (!logoData?.url || imageError) {
    return <LetterAvatar letter={companyName.charAt(0)} size={size} className={className} />;
  }

  // Check if it's a generic SVG (data URL)
  const isGenericSvg = logoData.url.startsWith('data:image/svg+xml');

  return (
    <div className={`${sizeClasses[size]} rounded-lg ${isGenericSvg ? '' : 'bg-white p-1'} flex items-center justify-center ${className}`}>
      <img
        src={logoData.url}
        alt={companyName}
        className="w-full h-full object-contain"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

/**
 * Hook to prefetch logos for a batch of tickers
 * Useful for portfolio views with many stocks
 */
export function usePreloadLogos(items: Array<{ ticker: string; companyName?: string }>) {
  const utils = trpc.useUtils();
  
  useEffect(() => {
    // Prefetch each logo
    items.forEach((item) => {
      if (item.ticker) {
        utils.logos.getLogoUrl.prefetch({ 
          ticker: item.ticker, 
          companyName: item.companyName 
        });
      }
    });
  }, [items, utils]);
}
