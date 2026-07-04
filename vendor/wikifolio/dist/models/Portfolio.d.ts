import { Wikifolio } from '.';
interface PortfolioItem {
    name: string;
    isin: string;
    quantity: number;
    averagePurchasePrice: number;
    ask: number;
    bid: number;
    close: number;
    percentage: number;
    link: string;
    issuer: any;
    mid: number;
    isLeveraged: boolean;
    isTicking: boolean;
    partnerName: string;
}
declare type PortfolioGroupName = 'cash' | 'bonds' | 'equities' | 'etfs' | 'structured-products' | 'wikifolio-certificates';
interface PortfolioGroup {
    type: number;
    name: PortfolioGroupName;
    value: number;
    percentage: number;
    items: PortfolioItem[];
}
export declare class Portfolio {
    wikifolio: Wikifolio;
    currency: string;
    totalValue: number;
    isSuper: boolean;
    groups: PortfolioGroup[];
    private static getGroupName;
    constructor({ groups, currency, totalValue, isSuper }: Portfolio, wikifolio: Wikifolio);
    set(portfolio: Partial<Portfolio>): any;
    get items(): PortfolioItem[];
}
export {};
