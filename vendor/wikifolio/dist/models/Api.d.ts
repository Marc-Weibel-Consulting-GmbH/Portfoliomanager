import { User, Wikifolio, WikifolioIdentifier, WikifolioSearch } from '.';
import { OptionsOfUnknownResponseBody } from 'got';
export interface RequestOpt extends OptionsOfUnknownResponseBody {
    method?: 'get' | 'post' | 'patch' | 'put' | 'delete';
}
interface Options {
    email: string;
    password: string;
    locale?: [string, string];
    defaults?: Defaults;
    timeout?: number;
}
interface Defaults {
    pageSize: number;
}
interface Opt extends Options {
    locale: [string, string];
    cookie?: string;
    timeout: number;
    defaults: Defaults;
}
export declare class Api {
    static hostname: string;
    static url: string;
    opt: Opt;
    constructor(options: Options);
    private auth;
    request(arg: string | RequestOpt, authorize?: boolean, fullResponse?: boolean): Promise<any>;
    wikifolio(idOrSymbol: WikifolioIdentifier | string): Wikifolio;
    search(search: Partial<WikifolioSearch>): Promise<Wikifolio[]>;
    watchlist(): Promise<Wikifolio[]>;
    user(nickname: string): User;
}
export {};
