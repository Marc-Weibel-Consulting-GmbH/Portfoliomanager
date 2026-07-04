import { Api, Wikifolio } from '.';
export declare class User {
    api: Api;
    private static instances;
    static instance(api: Api, nickname: string): User;
    sources: Set<string>;
    watchlist: string[];
    id?: string;
    nickname?: string;
    name?: string;
    seenAt?: Date;
    registeredAt?: Date;
    profileUrl?: string;
    topWikifolio?: Wikifolio;
    constructor(user: Partial<User> | undefined, api: Api);
    set(user: Partial<User>): any;
    /**
     * Fetch specific attributes (not in use yet)
     */
    private fetch;
    /**
     * Fetches User details from HTML (slow)
     */
    details(ignoreCache?: boolean): Promise<this>;
    wikifolios(): Promise<Wikifolio[]>;
}
