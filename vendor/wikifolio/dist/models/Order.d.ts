import { Api, Wikifolio, WikifolioOrdersParam } from '.';
declare type OrderBuySell = 'buy' | 'sell';
declare type OrderType = 'limit' | 'stop' | 'quote';
declare type OrderSecurityType = 'TakeProfit' | 'StopLoss';
export interface OrderParam {
    amount: number;
    limitPrice: number;
    orderType: OrderType;
    stopLossLimitPrice?: number;
    stopLossStopPrice?: number;
    stopPrice?: number;
    takeProfitLimitPrice?: number | null;
    underlyingIsin: string;
    expiresAt: Date | string;
}
export interface OrderPlaceParam extends OrderParam {
    buysell: OrderBuySell;
}
export declare class Order {
    wikifolio: Wikifolio;
    api: Api;
    private static instances;
    static instance(api: Api, wikifolio: Wikifolio, id: string): Order;
    /**
     * List orders of a wikifolio
     */
    static list(api: Api, wikifolio: Wikifolio, param: Partial<WikifolioOrdersParam>): Promise<Order[]>;
    children: Order[];
    sources: Set<string>;
    parent?: Order;
    id?: string;
    group?: string;
    isin?: string;
    description?: string;
    buysell?: OrderBuySell;
    orderType?: OrderType;
    securityType?: OrderSecurityType;
    status?: string;
    amount?: number;
    limitPrice?: number;
    stopPrice?: number;
    takeProfitLimitPrice?: number;
    stopLossStopPrice?: number;
    stopLossLimitPrice?: number;
    createdAt?: Date;
    expiresAt?: Date;
    constructor(order: Partial<Order> | undefined, wikifolio: Wikifolio, api: Api);
    set(order: Partial<Order>): any;
    /**
     * Place order
     */
    submit(order: Partial<OrderPlaceParam>): Promise<this>;
    /**
     * Remove order
     */
    remove(): Promise<any>;
    /**
     * Returns the quoteId required to place an order of type 'quote'
     */
    quoteId(order: Partial<OrderPlaceParam>): Promise<any>;
}
export {};
