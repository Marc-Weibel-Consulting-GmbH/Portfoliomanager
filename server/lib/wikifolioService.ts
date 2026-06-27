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

  const email = process.env.WIKIFOLIO_EMAIL;
  const password = process.env.WIKIFOLIO_PASSWORD;

  if (!email || !password) {
    throw new Error('WIKIFOLIO_EMAIL and WIKIFOLIO_PASSWORD must be set');
  }

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
  if (!setCookieHeader || (!loginResponse.body.endsWith('/dashboard') && !loginResponse.body.endsWith('/uebersicht') && !loginResponse.url?.includes('/dashboard') && !loginResponse.url?.includes('/uebersicht'))) {
    // Check if we got a redirect to dashboard (success indicator)
    const finalUrl = loginResponse.url || '';
    if (!finalUrl.includes('/dashboard') && !finalUrl.includes('/uebersicht') && !finalUrl.includes('/de/de/')) {
      throw new Error('Wikifolio login failed — check credentials');
    }
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

/**
 * Clear session (force re-login on next request)
 */
export function clearWikifolioSession(): void {
  sessionCookie = undefined;
  if (sessionTimeout) clearTimeout(sessionTimeout);
  console.log('[wikifolioService] Session cleared');
}
