/**
 * Wikifolio Service
 * Native implementation based on the unofficial API client:
 * https://github.com/MarcWeibel1971/wikifolio
 *
 * Uses session-based auth (cookie) against wikifolio.com
 */

import { CookieJar } from 'tough-cookie';
import { JSDOM } from 'jsdom';
import got from 'got';
import { Api as WikifolioApi, type Wikifolio, type WikifolioSearch } from 'wikifolio';
import { getSecret } from '../_core/secretsManager';

const BASE_URL = 'https://www.wikifolio.com/';
const cookieJar = new CookieJar();

// Session state
let sessionCookie: string | undefined;
let sessionTimeout: ReturnType<typeof setTimeout> | undefined;
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export interface WikifolioPortfolioItem {
  name: string;
  isin: string;
  quantity: number;
  averagePurchasePrice: number;
  ask: number;
  bid: number;
  close: number;
  percentage: number;
  link: string;
  mid: number;
  isLeveraged: boolean;
  isTicking: boolean;
  partnerName: string;
  groupName: string;
}

export interface WikifolioPortfolioGroup {
  type: number;
  name: string;
  value: number;
  percentage: number;
  items: WikifolioPortfolioItem[];
}

export interface WikifolioPortfolio {
  currency: string;
  totalValue: number;
  isSuper: boolean;
  groups: WikifolioPortfolioGroup[];
  items: WikifolioPortfolioItem[];
  fetchedAt: string;
}

export interface WikifolioDetails {
  symbol: string;
  name: string;
  shortDescription: string;
  currency: string;
  currentValue: number;
  performance1y: number;
  performanceEver: number;
  maxDrawdown: number;
  sharpeRatio: number;
  traderNickname: string;
  investmentUniverse: string;
  createdAt: string;
}

const groupTypeMap: Record<number, string> = {
  0: 'cash',
  610: 'bonds',
  620: 'equities',
  630: 'etfs',
  640: 'structured-products',
  650: 'wikifolio-certificates',
};

/**
 * Authenticate with Wikifolio and obtain a session cookie
 */
async function authenticate(): Promise<void> {
  if (sessionCookie) return; // Already authenticated

  // F-15: read credentials via secretsManager (checks process.env first,
  // then the encrypted appSecrets table maintained on the Admin-Secrets page)
  const { email, password } = await getWikifolioCredentials();

  const loginUrl = `${BASE_URL}dynamic/de/de/login/login`;

  // Step 1: Fetch login form to get CSRF tokens
  const formResponse = await (got as any)(loginUrl, {
    cookieJar,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });

  const { window: { document } } = new JSDOM(formResponse.body);
  const requestVerificationToken = (document.querySelector('[name=__RequestVerificationToken]') as HTMLInputElement)?.value;
  const ufprt = (document.querySelector('[name=ufprt]') as HTMLInputElement)?.value;

  if (!requestVerificationToken) {
    throw new Error('Could not find __RequestVerificationToken on login page');
  }

  // Step 2: Submit login form
  const loginResponse = await (got as any).post(loginUrl, {
    cookieJar,
    form: {
      Username: email,
      Password: password,
      ufprt: ufprt || '',
      __RequestVerificationToken: requestVerificationToken,
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    followRedirect: true,
  });

  const setCookieHeader = loginResponse.headers['set-cookie'];
  const bodyStr = loginResponse.body || '';
  const finalUrl = loginResponse.url || '';
  const loginSucceeded =
    bodyStr.includes('/uebersicht') ||
    bodyStr.includes('/dashboard') ||
    finalUrl.includes('/uebersicht') ||
    finalUrl.includes('/dashboard') ||
    finalUrl.includes('/de/de/');
  if (!setCookieHeader || !loginSucceeded) {
    throw new Error('Wikifolio login failed — check credentials');
  }

  // Extract the main session cookie
  const cookies = await cookieJar.getCookies(BASE_URL);
  const authCookie = cookies.find(c => c.key.toLowerCase().includes('auth') || c.key.toLowerCase().includes('session') || c.key.toLowerCase().includes('.wikifolio'));
  sessionCookie = authCookie?.toString() || cookies[0]?.toString();

  // Auto-expire session after TTL
  if (sessionTimeout) clearTimeout(sessionTimeout);
  sessionTimeout = setTimeout(() => {
    sessionCookie = undefined;
  }, SESSION_TTL_SECONDS * 1000);

  console.log(`[wikifolioService] Authenticated successfully. Session valid for ${SESSION_TTL_SECONDS / 3600}h`);
}

/**
 * Make an authenticated API request to Wikifolio
 */
async function request<T = any>(path: string): Promise<T> {
  await authenticate();

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  const response = await (got as any)(url, {
    cookieJar,
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });

  if (typeof response.body === 'string') {
    try {
      const parsed = JSON.parse(response.body);
      if (parsed?.message === 'Authorization has been denied for this request.') {
        // Session expired, clear and retry once
        sessionCookie = undefined;
        await authenticate();
        return request<T>(path);
      }
      return parsed as T;
    } catch {
      return response.body as unknown as T;
    }
  }

  return response.body as T;
}

/**
 * Fetch portfolio positions for a given wikifolio symbol
 * e.g. symbol = 'wfglobalnt'
 */
export async function getWikifolioPortfolio(symbol: string): Promise<WikifolioPortfolio> {
  const data = await request<any>(
    `api/wikifolio/${symbol}/portfolio?country=de&language=de`
  );

  const groups: WikifolioPortfolioGroup[] = (data.groups || []).map((g: any) => ({
    type: g.type,
    name: groupTypeMap[g.type] || 'other',
    value: g.value,
    percentage: g.percentage,
    items: (g.items || []).map((item: any) => ({
      name: item.name,
      isin: item.isin,
      quantity: item.quantity,
      averagePurchasePrice: item.averagePurchasePrice,
      ask: item.ask,
      bid: item.bid,
      close: item.close,
      percentage: item.percentage,
      link: item.link?.startsWith('http') ? item.link : `${BASE_URL}${item.link?.replace(/^\//, '')}`,
      mid: item.mid,
      isLeveraged: item.isLeveraged ?? false,
      isTicking: item.isTicking ?? false,
      partnerName: item.partnerName || '',
      groupName: groupTypeMap[g.type] || 'other',
    })),
  }));

  const allItems = groups.flatMap(g => g.items);

  return {
    currency: data.currency || 'EUR',
    totalValue: data.totalValue || 0,
    isSuper: data.isSuperWikifolio ?? false,
    groups,
    items: allItems,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch basic details for a wikifolio
 */
export async function getWikifolioDetails(symbol: string): Promise<WikifolioDetails | null> {
  try {
    const data = await request<any>(`api/wikifolio/${symbol}/basicdata`);
    return {
      symbol,
      name: data.name || symbol,
      shortDescription: data.shortDescription || '',
      currency: data.currency || 'EUR',
      currentValue: data.currentValue || 0,
      performance1y: data.performance1y || 0,
      performanceEver: data.performanceEver || 0,
      maxDrawdown: data.maxDrawdown || 0,
      sharpeRatio: data.sharpeRatio || 0,
      traderNickname: data.traderNickname || '',
      investmentUniverse: data.investmentUniverse || '',
      createdAt: data.createdAt || '',
    };
  } catch {
    return null;
  }
}

export interface WikifolioTradeRecord {
  externalTradeId: string | null;
  isin: string | null;
  name: string | null;
  side: 'buy' | 'sell' | 'other';
  executionPrice: number | null;
  weightage: number | null;
  executedAt: string | null;
}

/** Order-Typ von Wikifolio auf buy/sell/other normalisieren. */
function normalizeTradeSide(order: any): 'buy' | 'sell' | 'other' {
  const raw = String(order?.type ?? order?.orderType ?? '').toLowerCase();
  if (raw.startsWith('buy')) return 'buy';
  if (raw.startsWith('sell') || raw.includes('stoploss')) return 'sell';
  if (raw === 'buy') return 'buy';
  if (raw === 'sell') return 'sell';
  return 'other';
}

/**
 * Transaktionshistorie eines Wikifolios abrufen (Track B, AI_ALPHA_ROADMAP.md).
 * Endpunkt analog zum gevendorten Client: api/wikifolio/{idOrSymbol}/tradehistory.
 * `idOrSymbol` akzeptiert die Wikifolio-GUID oder das Symbol (die interne API toleriert
 * i. d. R. beides; die GUID ist die robustere Wahl, sobald bekannt).
 *
 * ⚠️ Die exakten Feldnamen der Antwort sind gegen die Live-API zu verifizieren
 * (Credentials nötig) — das Mapping ist defensiv gehalten.
 */
export async function getWikifolioTrades(idOrSymbol: string, pageSize = 50): Promise<WikifolioTradeRecord[]> {
  const data = await request<any>(
    `api/wikifolio/${idOrSymbol}/tradehistory?page=0&pageSize=${pageSize}&country=de&language=de`
  );

  const orders: any[] = data?.orders || data?.trades || (Array.isArray(data) ? data : []);
  return orders.map((order: any): WikifolioTradeRecord => ({
    externalTradeId: order.id ?? order.orderId ?? null,
    isin: order.isin ?? null,
    name: order.name ?? null,
    side: normalizeTradeSide(order),
    executionPrice: firstNumber(order.executionPrice, order.price),
    weightage: firstNumber(order.weightage, order.weight),
    executedAt: order.executedAt ?? order.executionDate ?? null,
  }));
}

/**
 * Clear session (force re-login on next request)
 */
export function clearWikifolioSession(): void {
  sessionCookie = undefined;
  if (sessionTimeout) clearTimeout(sessionTimeout);
  console.log('[wikifolioService] Session cleared');
}

// ─── Trader search (F-15) ────────────────────────────────────────────────────

async function getWikifolioCredentials(): Promise<{ email: string; password: string }> {
  const email = await getSecret('WIKIFOLIO_EMAIL');
  const password = await getSecret('WIKIFOLIO_PASSWORD');
  if (!email || !password) {
    throw new Error(
      'Wikifolio-Zugangsdaten fehlen — bitte WIKIFOLIO_EMAIL und WIKIFOLIO_PASSWORD in den Admin-Secrets hinterlegen.'
    );
  }
  return { email, password };
}

export type WikifolioSearchSortBy = 'perf12m' | 'sharperatio' | 'sharpe36m' | 'sharpe60m' | 'aum' | 'perfever' | 'perf36m' | 'perf60m' | 'topwikis';

export interface WikifolioTraderResult {
  symbol: string;
  title: string;
  traderName: string;
  /** Value of the selected sort criterion (main ranking value of the search) */
  rankValue: number | null;
  perfAnnually: number | null;
  perfEver: number | null;
  maxDrawdown: number | null;
  capital: number | null;
  isin: string | null;
  wikifolioUrl: string | null;
  /** Strategy tags from the search API (e.g. 'fundamental', 'aktde', 'alpha-strong') */
  tags: string[];
}

// Map our sortBy keys to the new search-api.wikifolio.com SortingOrder enum values
const SORT_BY_MAP: Record<WikifolioSearchSortBy, string> = {
  'perf12m': 'Performance1Year',
  'sharperatio': 'SharpeRatio',
  'sharpe36m': 'SharpeRatio36Months',
  'sharpe60m': 'SharpeRatio60Months',
  'aum': 'TotalInvestments',
  'perfever': 'PerformanceEver',
  'perf36m': 'Performance36Months',
  'perf60m': 'Performance60Months',
  'topwikis': 'TopWikifolios',
};

/**
 * Map Wikifolio search results from the new search-api.wikifolio.com format
 * to plain, serializable objects.
 */
/**
 * Erste vorhandene endliche Zahl aus mehreren möglichen Feldnamen ziehen (die
 * search-api liefert Kennzahlen je nach Version unter unterschiedlichen Keys —
 * daher defensiv über mehrere Kandidaten, statt hart auf `null`).
 */
function firstNumber(...vals: any[]): number | null {
  for (const v of vals) {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return null;
}

export function mapWikifolioSearchResults(wikis: any[]): WikifolioTraderResult[] {
  return wikis
    .filter(w => !!w.symbol)
    .map(w => {
      // Kennzahlen können flach am Objekt oder unter w.stats/w.keyFigures liegen.
      const s = w.stats || w.keyFigures || w.figures || {};
      const sharpe = firstNumber(w.sharpeRatio, w.sharpe, s.sharpeRatio, s.sharpe);
      const perfAnnually = firstNumber(w.performanceAnnualized, w.perfAnnually, s.performanceAnnualized, s.performance1Year, w.performance1Year);
      const perfEver = firstNumber(w.performanceEver, w.perfEver, s.performanceEver);
      const maxDrawdown = firstNumber(w.maxDrawdown, s.maxDrawdown);
      const capital = firstNumber(w.totalInvestments, w.investmentCapital, w.aum, s.totalInvestments);
      // rankValue = die Kennzahl, nach der sortiert wurde (Sharpe als sinnvoller Default).
      const rankValue = firstNumber(w.rankValue, sharpe, perfAnnually);
      return {
        symbol: w.symbol as string,
        title: w.shortDescription || w.symbol,
        traderName: w.trader?.fullName || w.trader?.nickName || '',
        rankValue,
        perfAnnually,
        perfEver,
        maxDrawdown,
        capital,
        isin: w.isin || null,
        wikifolioUrl: `https://www.wikifolio.com/de/de/w/${w.symbol?.toLowerCase()}`,
        tags: Array.isArray(w.tags) ? w.tags.slice(0, 5) : [],
      };
    });
}

/**
 * Search successful Wikifolio traders via the new search-api.wikifolio.com API.
 * Sorted descending by the given criterion; only investable real-money wikifolios.
 * No login required — the search API is public.
 */
export async function searchWikifolios(params: {
  sortBy: WikifolioSearchSortBy;
  query?: string;
  limit?: number;
}): Promise<WikifolioTraderResult[]> {
  const sortingOrder = SORT_BY_MAP[params.sortBy] || 'SharpeRatio';

  const requestBody = {
    count: params.limit ?? 25,
    offset: 0,
    fullText: params.query || '',
    country: 'de',
    filters: {
      isRealMoneyInvested: true,
      isInvestable: true,
    },
    orderBy: {
      direction: 'desc',
      orderBy: sortingOrder,
    },
  };

  let response: any;
  try {
    const resp = await (got as any).post('https://search-api.wikifolio.com/api/v1/search/wikifolios', {
      json: requestBody,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://www.wikifolio.com',
        'Referer': 'https://www.wikifolio.com/de/de/alle-wikifolios/suche',
      },
      responseType: 'json',
    });
    response = resp.body;
  } catch (err: any) {
    console.error('[wikifolioService] Trader search failed:', err?.message || err);
    throw new Error('Wikifolio-Suche fehlgeschlagen — bitte später erneut versuchen.');
  }

  const wikis: any[] = response?.wikifolios || [];
  return mapWikifolioSearchResults(wikis);
}

/**
 * Fetch key figures (Sharpe Ratio, performance, max drawdown, etc.) for a
 * wikifolio by calling the authenticated `analysis` endpoint.
 *
 * The search-api no longer returns these metrics, so we must fetch them
 * separately for each wikifolio after the initial search.
 *
 * Returns null on any error (e.g. private wikifolio, auth failure) so callers
 * can gracefully degrade to showing "—".
 */
export interface WikifolioKeyFigures {
  sharpeRatio: number | null;
  perfAnnually: number | null;
  perfEver: number | null;
  perf12m: number | null;
  maxDrawdown: number | null;
}

export async function getWikifolioKeyFigures(symbol: string): Promise<WikifolioKeyFigures | null> {
  // Always normalise to lowercase — the API path is case-sensitive
  const sym = symbol.toLowerCase();
  try {
    // basicdata already contains all key figures we need (sharpeRatio, performanceEver,
    // maxDrawdown, performance1y).  No separate analysis call required.
    const basicData = await request<any>(`api/wikifolio/${sym}/basicdata`);

    if (!basicData || typeof basicData !== 'object') return null;

    function toNum(v: any): number | null {
      if (v === null || v === undefined) return null;
      const n = typeof v === 'string' ? parseFloat(v.replace(',', '.').replace('%', '').replace(/\s/g, '')) : Number(v);
      return Number.isFinite(n) ? n : null;
    }

    // Try to extract from basicdata fields (field names vary by API version)
    const sharpeRatio = toNum(basicData.sharpeRatio ?? basicData.sharpe);
    const perfAnnually = toNum(basicData.performanceAnnualized ?? basicData.performancePerYear ?? basicData.perfAnnually);
    const perfEver = toNum(basicData.performanceEver ?? basicData.totalPerformance ?? basicData.perfEver);
    const perf12m = toNum(basicData.performance1y ?? basicData.performance12m ?? basicData.perf12m);
    const maxDrawdown = toNum(basicData.maxDrawdown ?? basicData.maximumDrawdown);

    // If basicdata has no useful data, try the analysis endpoint as fallback
    if (sharpeRatio === null && perfAnnually === null && perfEver === null) {
      const id = basicData?.id || basicData?.wikifolioId;
      if (id) {
        try {
          const analysisData = await request<any>(`api/wikifolio/${id}/analysis?country=de&language=de`);
          const keyFigures: any[] = analysisData?.analysis?.keyFigures || [];

          function findValue(label: string): number | null {
            const item = keyFigures.find((i: any) => i.label === label);
            if (!item) return null;
            const raw = item.value ?? item.displayValue;
            if (raw === null || raw === undefined) return null;
            const n = typeof raw === 'string' ? parseFloat(raw.replace(',', '.').replace('%', '').replace(/\s/g, '')) : raw;
            return Number.isFinite(n) ? n : null;
          }

          return {
            sharpeRatio: findValue('Sharpe Ratio'),
            perfAnnually: findValue('Ø-Performance pro Jahr'),
            perfEver: findValue('Performance seit Beginn'),
            perf12m: findValue('Performance 1 Jahr'),
            maxDrawdown: findValue('Maximaler Verlust (bisher)'),
          };
        } catch {
          // analysis endpoint also failed — return what we have from basicdata
        }
      }
    }

    return { sharpeRatio, perfAnnually, perfEver, perf12m, maxDrawdown };
  } catch (err: any) {
    console.warn(`[wikifolioService] Could not fetch key figures for ${sym}:`, err?.message);
    return null;
  }
}
