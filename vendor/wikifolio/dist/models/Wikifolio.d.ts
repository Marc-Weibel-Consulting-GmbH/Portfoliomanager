import { Api, Order, OrderParam, OrderPlaceParam, Portfolio, Trade, User } from '.';
export interface WikifolioIdentifier {
    id?: string;
    symbol?: string;
}
interface WikifolioParamCountry {
    country: string;
    language: string;
}
interface ParamPage {
    page: number;
    pageSize: number;
}
interface ParamCache {
    ignoreCache: boolean;
}
export interface WikifolioHistoryParam {
    generateArray: boolean;
    generateObject: boolean;
    useDate: boolean;
}
export interface WikifolioOrdersParam extends ParamPage {
}
interface WikifolioTradesParam extends ParamPage, WikifolioParamCountry {
}
interface WikifolioAnalysisParam extends ParamCache, WikifolioParamCountry {
}
declare type WikifolioSearchTag = 'aktde' | 'akteur' | 'akthot' | 'aktint' | 'etf' | 'anlagezert' | 'hebel' | 'schwer-d' | 'schwer-euro' | 'schwer-usa' | 'dividendenst' | 'ges-uni' | 'regel' | 'divers' | 'heavy-T' | 'langf-st' | 'rising-star' | 'top-ten-t' | 'guter-ko' | 'regelm-akt' | 'bestseller' | 'treue-anl' | 'research' | 'high-perf' | 'money-man' | 'konti-wach' | 'techanal' | 'fundamental' | 'sonstige' | 'cureur' | 'curchf';
export interface WikifolioSearch {
    query: string;
    tags: WikifolioSearchTag[];
    sortOrder: 'desc' | 'asc';
    sortBy: 'topwikis' | 'newestwiki' | 'firstem' | 'esgScore' | 'perfannually' | 'perfever' | 'perfemission' | 'perfytd' | 'perf12m' | 'perf6m' | 'perf3m' | 'perf1m' | 'sharperatio' | 'maxdraw' | 'aum' | 'buyint' | 'risk';
    startValue: number;
    media: boolean;
    private: boolean;
    assetmanager: boolean;
    theme: boolean;
    super: boolean;
    languageOnly: boolean;
    investable: boolean;
    realMoney: boolean;
    savingplan: boolean;
    LeverageProductsOnly: boolean;
    WithoutLeverageProductsOnly: boolean;
    perfever: string;
    perfemission: string;
    perfannually: string;
    perfytd: string;
    esgScore: string;
    maxdraw: string;
    aum: string;
    risk: string;
    perf12m: string;
    perf6m: string;
    perf3m: string;
    perf1m: string;
    sharperatio: string;
    buyint: string;
}
interface WikifolioComment {
    ref?: string;
    html: string;
    text: string;
    createdAt: Date;
}
export declare class Wikifolio {
    private api;
    private static instances;
    static instance(api: Api, identifier: WikifolioIdentifier | string): Wikifolio;
    /**
     * Transforms a string into an identifier object
     */
    private static parseIdentifier;
    /**
     * Returns a list of found Wikifolio[]
     */
    static search(api: Api, param?: Partial<WikifolioSearch>): Promise<Wikifolio[]>;
    /**
     * Returns watchlisted Wikifolio[]
     */
    static watchlist(api: Api): Promise<Wikifolio[]>;
    constructor(identifiers: WikifolioIdentifier, api: Api);
    set(wikifolio: Partial<Wikifolio>): any;
    sources: Set<string>;
    user?: User;
    id?: string;
    symbol?: string;
    wikifolioUrl?: string;
    isin?: string;
    wkn?: string;
    createdAt?: Date;
    publishedAt?: Date;
    status?: number;
    tags?: string[];
    capital?: number;
    title?: string;
    tradeidea?: string;
    highWatermark?: number;
    indexLevel?: number;
    fee?: number;
    liquidation?: number;
    tradingVolume?: number;
    decisionMaking?: string[];
    chartImgUrl?: string;
    investable?: boolean;
    containsLeverageProducts?: boolean;
    realMoney?: boolean;
    isWatchlisted?: boolean;
    name?: string;
    isOwned?: boolean;
    rank?: number;
    isSuper?: boolean;
    isChallenge?: boolean;
    isClosed?: boolean;
    sharperatio?: number;
    perf12m?: number;
    perf6m?: number;
    perf3m?: number;
    perf1m?: number;
    perfever?: number;
    perfemission?: number;
    perfannually?: number;
    perfytd?: number;
    esgScore?: number;
    maxdraw?: number;
    aum?: number;
    risk?: number;
    perftoday?: number;
    perfintra?: number;
    perf52weekHigh?: number;
    ask?: number;
    bid?: number;
    quantityLimitBid?: number;
    quantityLimitAsk?: number;
    priceCalculatedAt?: Date;
    priceValidUntil?: Date;
    midPrice?: number;
    showMidPrice?: boolean;
    currency?: string;
    isCurrencyConverted?: boolean;
    isTicking?: boolean;
    isNotificationSet?: boolean;
    buyint?: number;
    bought30d?: number;
    perf36m?: number;
    perf60m?: number;
    perf52week?: number;
    tradevol30d?: number;
    perfbuy?: number;
    comments?: WikifolioComment[];
    category?: string;
    /**
     * Fetch specific attributes
     */
    private fetch;
    /**
     * Fetch basic data, mainly required for obtaining the ID when only a symbol is provided
     */
    basics(ignoreCache?: boolean): Promise<this>;
    /**
     * Fetches Wikifolio details from HTML (slow)
     */
    details(ignoreCache?: boolean): Promise<this>;
    /**
     * Fetch wikifolio price
     */
    price(ignoreCache?: boolean): Promise<this>;
    /**
     * Wikifolio download
     */
    download(type?: 'daily' | 'account-statement', from?: Date, to?: Date): Promise<string>;
    /**
     * Fetch portfolio
     */
    portfolio(): Promise<Portfolio>;
    /**
     * Loads performance information
     */
    analysis({ ignoreCache, ...param }?: Partial<WikifolioAnalysisParam>): Promise<this>;
    /**
     * Fetches Trade[] sorted by date
     */
    trades(param?: Partial<WikifolioTradesParam>): Promise<{
        pageCount: number;
        trades: Trade[];
    }>;
    history({ useDate, generateArray, generateObject }?: Partial<WikifolioHistoryParam>): Promise<any>;
    /**
     * Toggle watchlist status of wikifolio
     */
    watchlist(add?: boolean): Promise<boolean>;
    /**
     * Get order
     */
    order(id: string): Order;
    /**
     * Returns open trades of a wikifolio
     */
    orders(param?: Partial<WikifolioOrdersParam>): Promise<Order[]>;
    /**
     * Place wikifolio order
     */
    trade(order: Partial<OrderPlaceParam>): Promise<Order>;
    /**
     * Place a buy order
     */
    buy(order: Partial<OrderParam>): Promise<Order>;
    /**
     * Place a sell order
     */
    sell(order: Partial<OrderParam>): Promise<Order>;
}
export {};
