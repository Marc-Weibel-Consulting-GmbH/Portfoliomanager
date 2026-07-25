export const COOKIE_NAME = "app_session_id";
export const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;
// Session-Gueltigkeit: an Cookie-maxAge (30 Tage) angeglichen — ein JWT darf
// nicht laenger leben als das Cookie, sonst existieren nicht widerrufbare Tokens.
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/** Flat lookup: ticker (uppercase) → Anlageklassen-Label for Multi-Asset Sleeve ETFs */
export const SLEEVE_TICKER_LABEL: Record<string, string> = {
  // Obligationen
  'AGGH.SW': 'Obligationen',
  'AGG': 'Obligationen',
  'CSBGC0.SW': 'Obligationen',
  // Rohstoffe
  'CMDY': 'Rohstoffe',
  'PDBC': 'Rohstoffe',
  // Gold
  'ZGLD.SW': 'Gold',
  'CSGLDE.SW': 'Gold',
  'SGLN.L': 'Gold',
  // Immobilien
  'REET': 'Immobilien',
  'VNQI': 'Immobilien',
  // Krypto
  'ABTC.SW': 'Krypto',
  'ASOL.SW': 'Krypto',
  'VSOL.SW': 'Krypto',
};

/** Icon/color config for each asset class label */
export const SLEEVE_LABEL_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  'Obligationen': { icon: '🟦', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  'Gold':         { icon: '🟡', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)' },
  'Rohstoffe':    { icon: '🟧', color: '#fb923c', bg: 'rgba(251,146,60,0.15)' },
  'Immobilien':   { icon: '🏠', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  'Krypto':       { icon: '🟣', color: '#f472b6', bg: 'rgba(244,114,182,0.15)' },
};
