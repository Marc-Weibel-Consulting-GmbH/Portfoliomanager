/**
 * Asset-Class-Aware Signal Generation (ACS-1, 2026-07)
 *
 * Obligationen, Gold, Rohstoffe, Krypto und Immobilien-ETFs haben keine
 * P/E- oder PEG-Ratios. Stattdessen werden assetklassen-spezifische
 * Indikatoren verwendet:
 *
 * - Obligationen: Yield (Coupon-Proxy), RSI, 52W-Range, Volatilität
 * - Gold:         52W-Range, RSI, Momentum (YTD), Volatilität
 * - Rohstoffe:    52W-Range, RSI, Momentum (YTD), Volatilität
 * - Krypto:       52W-Range, RSI, Momentum (YTD) — höhere Schwellen
 * - Immobilien:   Yield (REIT-Ausschüttung), 52W-Range, RSI, Volatilität
 *
 * Für Aktien (equity) wird weiterhin generateSignal() aus baseSignal.ts verwendet.
 */

import type { SignalType, SignalStrength, BaseSignal } from './baseSignal';

export type AssetClass = 'equity' | 'bond' | 'gold' | 'commodity' | 'crypto' | 'realestate';

/** Detect asset class from category string (from stocks.category or SLEEVE_TICKER_LABEL) */
export function detectAssetClass(category?: string | null, assetType?: string | null): AssetClass {
  const cat = (category || '').toLowerCase();
  const at = (assetType || '').toLowerCase();

  if (at === 'bond' || cat.includes('obligation') || cat.includes('bond') || cat.includes('anleihe')) return 'bond';
  if (cat.includes('gold')) return 'gold';
  if (cat.includes('rohstoff') || cat.includes('commodity') || cat.includes('rohwaren')) return 'commodity';
  if (at === 'crypto' || cat.includes('krypto') || cat.includes('crypto')) return 'crypto';
  if (cat.includes('immobilien') || cat.includes('realestate') || cat.includes('reit')) return 'realestate';
  return 'equity';
}

/** German labels for asset classes */
export const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity: 'Aktie',
  bond: 'Obligation',
  gold: 'Gold',
  commodity: 'Rohstoff',
  crypto: 'Krypto',
  realestate: 'Immobilien',
};

/** Score description per asset class (shown under the score number) */
export const ASSET_CLASS_SCORE_DESC: Record<AssetClass, string> = {
  equity: 'P/E · PEG · Beta · Volatilität · Sharpe',
  bond: 'Yield · RSI · 52W-Range · Volatilität',
  gold: 'Momentum · RSI · 52W-Range · Volatilität',
  commodity: 'Momentum · RSI · 52W-Range · Volatilität',
  crypto: 'Momentum · RSI · 52W-Range',
  realestate: 'Yield · RSI · 52W-Range · Volatilität',
};

/** Signal score description per asset class */
export const ASSET_CLASS_SIGNAL_DESC: Record<AssetClass, string> = {
  equity: 'Momentum + Qualität + LPPL-Risiko',
  bond: 'Yield-Trend + Momentum',
  gold: 'Momentum + Trend',
  commodity: 'Momentum + Trend',
  crypto: 'Momentum + Trend',
  realestate: 'Yield-Trend + Momentum',
};

/** Bewertungs-Score tooltip description per asset class */
export const ASSET_CLASS_BEWERTUNG_DESC: Record<AssetClass, string> = {
  equity: 'Bewertet P/E, PEG, Beta, Volatilität und Sharpe. Höher = günstiger/robuster.',
  bond: 'Bewertet Yield (Coupon), RSI-Momentum und Volatilität. Höher = attraktivere Obligation.',
  gold: 'Bewertet Momentum (YTD), RSI und Position in der 52W-Range. Höher = stärkerer Aufwärtstrend.',
  commodity: 'Bewertet Momentum (YTD), RSI und Position in der 52W-Range. Höher = stärkerer Aufwärtstrend.',
  crypto: 'Bewertet Momentum (YTD), RSI und Position in der 52W-Range. Krypto-angepasste Schwellen.',
  realestate: 'Bewertet Ausschüttungsrendite (REIT), RSI und Volatilität. Höher = attraktiverer REIT.',
};

/**
 * Generate a signal for non-equity assets.
 * Returns a BaseSignal-compatible object with asset-class-specific logic.
 */
export function generateAssetClassSignal(data: {
  ticker: string;
  companyName: string;
  assetClass: AssetClass;
  dividendYield: number;        // For bonds/REITs: yield/coupon; for others: 0
  currentPrice: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  ytdPerformance: number;
  rsi14: number | null;
  volatility?: number | null;
}): BaseSignal {
  const {
    ticker, companyName, assetClass,
    dividendYield, currentPrice,
    fiftyTwoWeekHigh, fiftyTwoWeekLow,
    ytdPerformance, rsi14, volatility,
  } = data;

  const criteria: string[] = [];
  let score = 0;

  // ── 52-Week Range (universal for all non-equity) ──────────────────────────
  if (fiftyTwoWeekHigh && fiftyTwoWeekLow && currentPrice > 0) {
    const range = fiftyTwoWeekHigh - fiftyTwoWeekLow;
    if (range > 0) {
      const pos = (currentPrice - fiftyTwoWeekLow) / range;
      if (pos < 0.2) {
        score += 3;
        criteria.push(`Nahe 52W-Tief (${(pos * 100).toFixed(0)}%)`);
      } else if (pos < 0.35) {
        score += 1;
        criteria.push(`Untere 52W-Range (${(pos * 100).toFixed(0)}%)`);
      } else if (pos > 0.95) {
        score -= 1;
        criteria.push(`Nahe 52W-Hoch (${(pos * 100).toFixed(0)}%)`);
      }
    }
  }

  // ── RSI (universal) ───────────────────────────────────────────────────────
  if (rsi14 !== null && !isNaN(rsi14)) {
    // Krypto: höhere Schwellen (Überkauft erst bei 80, überverkauft bei 25)
    const oversold = assetClass === 'crypto' ? 25 : 30;
    const oversoldMild = assetClass === 'crypto' ? 35 : 40;
    const overbought = assetClass === 'crypto' ? 80 : 70;
    const overboughtMild = assetClass === 'crypto' ? 70 : 65;

    if (rsi14 < oversold) {
      score += 3;
      criteria.push(`RSI überverkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 < oversoldMild) {
      score += 1;
      criteria.push(`RSI niedrig (${rsi14.toFixed(0)})`);
    } else if (rsi14 > overbought) {
      score -= 2;
      criteria.push(`RSI überkauft (${rsi14.toFixed(0)})`);
    } else if (rsi14 > overboughtMild) {
      score -= 1;
      criteria.push(`RSI hoch (${rsi14.toFixed(0)})`);
    }
  }

  // ── YTD Momentum ─────────────────────────────────────────────────────────
  if (ytdPerformance !== 0 && !isNaN(ytdPerformance)) {
    if (assetClass === 'bond') {
      // Bonds: YTD momentum is less important; small moves are normal
      if (ytdPerformance < -8) { score += 2; criteria.push(`Stark gefallen YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance < -3) { score += 1; criteria.push(`Leicht gefallen YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance > 8) { score -= 1; criteria.push(`Stark gestiegen YTD (${ytdPerformance.toFixed(1)}%)`); }
    } else if (assetClass === 'crypto') {
      // Crypto: higher thresholds for momentum signals
      if (ytdPerformance < -50) { score += 2; criteria.push(`Stark überverkauft YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance < -30) { score += 1; criteria.push(`Deutlich gefallen YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance > 150) { score -= 2; criteria.push(`Stark überkauft YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance > 80) { score -= 1; criteria.push(`Stark gestiegen YTD (${ytdPerformance.toFixed(1)}%)`); }
    } else {
      // Gold, Commodity, RealEstate: moderate thresholds
      if (ytdPerformance < -20) { score += 2; criteria.push(`Stark überverkauft YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance < -10) { score += 1; criteria.push(`Deutlich gefallen YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance > 40) { score -= 2; criteria.push(`Stark überkauft YTD (${ytdPerformance.toFixed(1)}%)`); }
      else if (ytdPerformance > 25) { score -= 1; criteria.push(`Stark gestiegen YTD (${ytdPerformance.toFixed(1)}%)`); }
    }
  }

  // ── Yield (Bonds & REITs only) ────────────────────────────────────────────
  if ((assetClass === 'bond' || assetClass === 'realestate') && dividendYield > 0) {
    if (assetClass === 'bond') {
      // Bond yield: 4%+ is attractive in current environment
      if (dividendYield >= 5) { score += 3; criteria.push(`Hohe Rendite (${dividendYield.toFixed(2)}%)`); }
      else if (dividendYield >= 3.5) { score += 2; criteria.push(`Gute Rendite (${dividendYield.toFixed(2)}%)`); }
      else if (dividendYield >= 2) { score += 1; criteria.push(`Moderate Rendite (${dividendYield.toFixed(2)}%)`); }
      else if (dividendYield < 1) { score -= 1; criteria.push(`Niedrige Rendite (${dividendYield.toFixed(2)}%)`); }
    } else {
      // REIT yield: 3%+ is attractive
      if (dividendYield >= 5) { score += 3; criteria.push(`Hohe Ausschüttung (${dividendYield.toFixed(1)}%)`); }
      else if (dividendYield >= 3.5) { score += 2; criteria.push(`Gute Ausschüttung (${dividendYield.toFixed(1)}%)`); }
      else if (dividendYield >= 2.5) { score += 1; criteria.push(`Moderate Ausschüttung (${dividendYield.toFixed(1)}%)`); }
    }
  }

  // ── Volatility (bonds only: low vol = better) ─────────────────────────────
  if (assetClass === 'bond' && volatility != null && volatility > 0) {
    if (volatility < 3) { score += 1; criteria.push(`Niedrige Volatilität (${volatility.toFixed(1)}%)`); }
    else if (volatility > 10) { score -= 1; criteria.push(`Erhöhte Volatilität (${volatility.toFixed(1)}%)`); }
  }

  // ── Determine signal ──────────────────────────────────────────────────────
  let type: SignalType;
  let strength: SignalStrength;
  let reason: string;
  let targetPrice: number;

  const label = ASSET_CLASS_LABEL[assetClass];

  if (score >= 5) {
    type = 'buy'; strength = 'strong';
    reason = `Starkes Kaufsignal: ${label} zeigt technische Stärke und attraktive Einstiegspunkte.`;
    targetPrice = currentPrice * 1.12;
  } else if (score >= 3) {
    type = 'buy'; strength = 'moderate';
    reason = `Moderates Kaufsignal: ${label} zeigt positive Momentum-Indikatoren.`;
    targetPrice = currentPrice * 1.07;
  } else if (score >= 1) {
    type = 'buy'; strength = 'weak';
    reason = `Leichte Kauftendenz: Einzelne positive Signale für ${label}.`;
    targetPrice = currentPrice * 1.03;
  } else if (score <= -4) {
    type = 'sell'; strength = 'strong';
    reason = `Starkes Verkaufssignal: ${label} zeigt überkaufte Indikatoren.`;
    targetPrice = currentPrice * 0.90;
  } else if (score <= -2) {
    type = 'sell'; strength = 'moderate';
    reason = `Moderates Verkaufssignal: ${label} zeigt Schwächezeichen.`;
    targetPrice = currentPrice * 0.95;
  } else {
    type = 'hold'; strength = 'moderate';
    reason = `Neutrale Bewertung: ${label} — Position halten und Entwicklung beobachten.`;
    targetPrice = currentPrice;
  }

  return {
    ticker,
    companyName,
    type,
    strength,
    currentPrice,
    targetPrice,
    peRatio: null,
    pegRatio: null,
    dividendYield,
    ytdPerformance,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    rsi14,
    reason,
    criteria,
  };
}
