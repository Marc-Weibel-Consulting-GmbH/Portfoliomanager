"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wikifolio = void 0;
var utils_1 = require("../utils");
var _1 = require(".");
var regex = {
    script: /<script type="text\/json">(.*)<\/script>/g,
    wikifolioData: /window\.wikifolio\.data = ({[^}]+})/
};
var Wikifolio = /** @class */ (function () {
    function Wikifolio(identifiers, api) {
        this.api = api;
        this.sources = new Set();
        this.set(identifiers);
    }
    Wikifolio.instance = function (api, identifier) {
        var id = typeof identifier === 'string' ? Wikifolio.parseIdentifier(identifier) : identifier;
        var hash = JSON.stringify(id);
        return this.instances[hash] = this.instances[hash]
            || new Wikifolio(id, api);
    };
    /**
     * Transforms a string into an identifier object
     */
    Wikifolio.parseIdentifier = function (identifier) {
        switch (identifier.length) {
            case 8: return { symbol: 'wf' + identifier };
            case 10: return { symbol: identifier };
            default: return { id: identifier };
        }
    };
    /**
     * Returns a list of found Wikifolio[]
     */
    Wikifolio.search = function (api, param) {
        if (param === void 0) { param = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var html, match, wikis, json, wikifolioFullName, isWatchlisted, mainRankingValue, status_1, tags, title, rankingValues, wikifolioUrl, chartImgUrl, wikifolioId, wikifolioIsin, editor, wiki, capital, user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, api.request("dynamic/" + api.opt.locale.join('/') + "/wikifoliosearch/search" + utils_1.toQueryString(__assign({ _: +new Date(), tags: ['aktde', 'akteur', 'aktusa', 'akthot', 'aktint', 'etf', 'fonds', 'anlagezert', 'hebel'], media: true, private: true, assetmanager: true, theme: true, super: true }, param)))];
                    case 1:
                        html = _a.sent();
                        wikis = [];
                        do {
                            match = regex.script.exec(html);
                            if (!match)
                                continue;
                            json = JSON.parse(match[1]);
                            wikifolioFullName = json.wikifolioFullName, isWatchlisted = json.isWatchlisted, mainRankingValue = json.mainRankingValue, status_1 = json.status, tags = json.tags, title = json.shortDescription, rankingValues = json.rankingValues, wikifolioUrl = json.wikifolioUrl, chartImgUrl = json.chartImgUrl, wikifolioId = json.wikifolioId, wikifolioIsin = json.wikifolioIsin, editor = json.editor;
                            wiki = new Wikifolio({ symbol: wikifolioFullName }, api);
                            capital = rankingValues.find(function (i) { return i.label === 'Investiertes Kapital'; });
                            user = editor.name.split(' | ');
                            wiki.set({
                                capital: capital ? utils_1.toCurrency(capital.displayValue) : 0,
                                rank: utils_1.toFloat(mainRankingValue.displayValue),
                                tags: tags.map(function (t) { return t.text; }),
                                id: wikifolioId,
                                isin: wikifolioIsin || undefined,
                                user: _1.User.instance(api, user[1]).set({
                                    name: user[0],
                                    profileUrl: _1.Api.url + editor.url.substr(1)
                                }),
                                createdAt: utils_1.toDate(rankingValues.find(function (i) { return i.label === 'Erstellungsdatum'; }).displayValue),
                                publishedAt: utils_1.toDate(rankingValues.find(function (i) { return i.label === 'Erstemission'; }).displayValue),
                                fee: utils_1.toInt(rankingValues.find(function (i) { return i.label === 'Performancegebühr'; }).displayValue),
                                maxdraw: utils_1.toFloat(rankingValues.find(function (i) { return i.label === 'Maximaler Verlust (bisher)'; }).displayValue),
                                perfever: utils_1.toFloat(rankingValues.find(function (i) { return i.label === 'Performance seit Beginn'; }).displayValue),
                                perfannually: utils_1.toFloat(rankingValues.find(function (i) { return i.label === 'Ø-Performance pro Jahr'; }).displayValue),
                                title: title,
                                isWatchlisted: isWatchlisted,
                                chartImgUrl: chartImgUrl,
                                wikifolioUrl: _1.Api.url + wikifolioUrl.substr(1),
                                status: status_1
                            });
                            wikis.push(wiki);
                        } while (match != null);
                        return [2 /*return*/, wikis];
                }
            });
        });
    };
    /**
     * Returns watchlisted Wikifolio[]
     */
    Wikifolio.watchlist = function (api) {
        return __awaiter(this, void 0, void 0, function () {
            var html, match, wikis, searchResults, _i, searchResults_1, item, isNotificationSet, rankings, status_2, id, isin, title, chartImgUrl, wikifolioUrl, editor, rankingValues, symbol, wikifolio, user;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, api.request(api.opt.locale.join('/') + "/watchlist/" + (api.opt.locale[0] === 'de' ? 'bearbeiten' : 'edit'))];
                    case 1:
                        html = _a.sent();
                        match = regex.script.exec(html);
                        wikis = [];
                        searchResults = JSON.parse(match[1]).searchResults;
                        for (_i = 0, searchResults_1 = searchResults; _i < searchResults_1.length; _i++) {
                            item = searchResults_1[_i];
                            isNotificationSet = item.isNotificationSet, rankings = item.rankings, status_2 = item.status, id = item.wikifolioId, isin = item.wikifolioIsin, title = item.shortDescription, chartImgUrl = item.chartImgUrl, wikifolioUrl = item.wikifolioUrl, editor = item.editor, rankingValues = item.rankingValues;
                            symbol = wikifolioUrl.split('/').slice(-1)[0];
                            wikifolio = new Wikifolio({ symbol: symbol, id: id }, api);
                            user = editor.name.split(' | ');
                            wikifolio.set({
                                isin: isin,
                                title: title,
                                user: _1.User.instance(api, user[1]).set({
                                    name: user[0],
                                    profileUrl: _1.Api.url + editor.url.substr(1)
                                }),
                                isNotificationSet: isNotificationSet,
                                fee: utils_1.toInt(rankingValues.find(function (i) { return i.label === 'Performancegebühr'; }).displayValue),
                                publishedAt: utils_1.toDate(rankingValues.find(function (i) { return i.label === 'Erstemission'; }).displayValue),
                                createdAt: utils_1.toDate(rankings.find(function (i) { return i.identifier === 'newestwiki'; }).displayValue),
                                rank: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'topwikis'; }).displayValue),
                                buyint: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'buyint'; }).displayValue),
                                bought30d: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'bought30d'; }).displayValue),
                                perfever: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perfever'; }).displayValue),
                                perfemission: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perfemission'; }).displayValue),
                                perfytd: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perfytd'; }).displayValue),
                                capital: utils_1.toCurrency(rankings.find(function (i) { return i.identifier === 'aum'; }).displayValue),
                                tradevol30d: utils_1.toCurrency(rankings.find(function (i) { return i.identifier === 'tradevol30d'; }).displayValue),
                                perfbuy: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perfbuy'; }).displayValue),
                                perfannually: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perfannually'; }).displayValue),
                                perf60m: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf60m'; }).displayValue),
                                perf36m: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf36m'; }).displayValue),
                                perf12m: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf12m'; }).displayValue),
                                perf52week: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf52week'; }).displayValue),
                                perf6m: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf6m'; }).displayValue),
                                perf3m: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf3m'; }).displayValue),
                                perf1m: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'perf1m'; }).displayValue),
                                maxdraw: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'maxdraw'; }).displayValue),
                                sharperatio: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'sharperatio'; }).displayValue),
                                esgScore: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'esgScore'; }).displayValue),
                                risk: utils_1.toFloat(rankings.find(function (i) { return i.identifier === 'risk'; }).displayValue),
                                chartImgUrl: chartImgUrl,
                                wikifolioUrl: _1.Api.url + wikifolioUrl.substr(1),
                                status: status_2
                            });
                            wikis.push(wikifolio);
                        }
                        return [2 /*return*/, wikis];
                }
            });
        });
    };
    Wikifolio.prototype.set = function (wikifolio) {
        return Object.assign(this, utils_1.removeValues(wikifolio));
    };
    /**
     * Fetch specific attributes
     */
    Wikifolio.prototype.fetch = function () {
        var attributes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            attributes[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // remove loaded attributes
                        attributes = attributes.filter(function (a) { return !_this[a]; });
                        if (!(this.isOwned === undefined && attributes.includes('isOwned'))) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.details()];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!(this.id === undefined && attributes.includes('id'))) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.basics()];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4:
                        if (attributes.includes('symbol')) {
                            // TODO: find a way to get the symbol with only the id provided
                            throw new Error('Missing Wikifolio symbol');
                        }
                        return [2 /*return*/, this];
                }
            });
        });
    };
    /**
     * Fetch basic data, mainly required for obtaining the ID when only a symbol is provided
     */
    Wikifolio.prototype.basics = function (ignoreCache) {
        if (ignoreCache === void 0) { ignoreCache = false; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, id, title, traderNickname, performanceEver, performanceToday;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.sources.has('basics') && !ignoreCache)
                            return [2 /*return*/, this];
                        return [4 /*yield*/, this.fetch('symbol')];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.api.request("api/wikifolio/" + this.symbol + "/basicdata")];
                    case 2:
                        _a = _b.sent(), id = _a.id, title = _a.title, traderNickname = _a.traderNickname, performanceEver = _a.performanceEver, performanceToday = _a.performanceToday;
                        this.sources.add('basics');
                        return [2 /*return*/, this.set({
                                id: id, title: title,
                                user: _1.User.instance(this.api, traderNickname),
                                perfever: utils_1.toFloat(performanceEver.displayValue),
                                perftoday: utils_1.toFloat(performanceToday.displayValue)
                            })];
                }
            });
        });
    };
    /**
     * Fetches Wikifolio details from HTML (slow)
     */
    Wikifolio.prototype.details = function (ignoreCache) {
        if (ignoreCache === void 0) { ignoreCache = false; }
        return __awaiter(this, void 0, void 0, function () {
            var wikifolioUrl, _a, html, $, $$, attribute, string, float, date, currency, _b, json, _c, wikifolioId, userId, userOwnsWikifolio, isSuperWikifolio, isChallengeWikifolio, containsLeverageProducts, table, tableHTML, publishedAt, fee, liquidation, tradingVolume, nickname, user;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (this.sources.has('details') && !ignoreCache)
                            return [2 /*return*/, this];
                        return [4 /*yield*/, this.fetch('symbol')];
                    case 1:
                        _d.sent();
                        wikifolioUrl = this.api.opt.locale.join('/') + "/w/" + this.symbol;
                        _b = utils_1.parseHtml;
                        return [4 /*yield*/, this.api.request(wikifolioUrl)];
                    case 2:
                        _a = _b.apply(void 0, [_d.sent()]), html = _a.html, $ = _a.$, $$ = _a.$$, attribute = _a.attribute, string = _a.string, float = _a.float, date = _a.date, currency = _a.currency;
                        json = regex.wikifolioData.exec(html);
                        if (!json || !json[1]) {
                            throw new Error('Wikifolio JSON not found. This is probably a bug, please report it.');
                        }
                        _c = eval("(" + json[1] + ")"), wikifolioId = _c.wikifolioId, userId = _c.userId, userOwnsWikifolio = _c.userOwnsWikifolio, isSuperWikifolio = _c.isSuperWikifolio, isChallengeWikifolio = _c.isChallengeWikifolio, containsLeverageProducts = _c.containsLeverageProducts;
                        table = $('table.c-certificate__key-table');
                        if (!table)
                            return [2 /*return*/, this.set({ id: wikifolioId, isClosed: true })];
                        tableHTML = table.innerHTML;
                        publishedAt = utils_1.toDate(utils_1.matchResult(/Erstemission<\/td>\s[^>]+>\s.+([0-9.]{10})/, tableHTML));
                        fee = parseInt(utils_1.matchResult(/Performancegebühr<\/td>\s[^>]+>\s[ ]+([^ ]+)/, tableHTML));
                        liquidation = utils_1.toFloat(utils_1.matchResult(/Liquidationskennzahl<\/td>\s[^>]+>\s[ ]+([^ ]+)/, tableHTML));
                        tradingVolume = utils_1.toCurrency(utils_1.matchResult(/Handelsvolumen<\/td>\s.+\s.+\s[ ]+([^ ]+)/, tableHTML));
                        nickname = string('.c-trader__name:nth-child(2)');
                        user = _1.User.instance(this.api, nickname);
                        user.set({
                            id: userId,
                            name: string('.c-trader__name:nth-child(2)'),
                            profileUrl: _1.Api.url + attribute('.gtm-profile-link', 'href').substr(1)
                        });
                        this.set({
                            user: user,
                            id: wikifolioId,
                            isClosed: false,
                            wikifolioUrl: _1.Api.url + wikifolioUrl.substr(1),
                            isin: string('.gtm-copy-isin'),
                            title: string('.c-wf-head__title-text'),
                            isOwned: userOwnsWikifolio,
                            capital: currency('.c-certificate__item:nth-child(2) .c-certificate__item-value'),
                            createdAt: date('.c-masterdata__item:nth-child(2) td:nth-child(2) span'),
                            publishedAt: publishedAt,
                            fee: fee,
                            liquidation: liquidation,
                            tradingVolume: tradingVolume,
                            indexLevel: float('.c-masterdata__item:nth-child(3) .js-masterdata__index-level'),
                            highWatermark: float('.c-masterdata__item:nth-child(4) td.u-ta-r span'),
                            perfever: float('.c-ranking-box--large .c-ranking-item:nth-child(1) .c-ranking-item__value'),
                            perf12m: float('.c-ranking-box--large .c-ranking-item:nth-child(2) .c-ranking-item__value'),
                            perfannually: float('.c-ranking-box--large .c-ranking-item:nth-child(3) .c-ranking-item__value'),
                            maxdraw: float('.c-ranking-box--small .c-ranking-item__value'),
                            risk: float('.c-risk-factor'),
                            isSuper: isSuperWikifolio,
                            isChallenge: isChallengeWikifolio,
                            isWatchlisted: !!$('.js-remove-from-watchlist'),
                            containsLeverageProducts: containsLeverageProducts,
                            investable: !!$('.c-status-icon-wrapper[title*="Investierbar"]'),
                            realMoney: !!$('.c-status-icon-wrapper[title*="Real Money"]'),
                            tradeidea: string('.js-tradeidea__content'),
                            decisionMaking: $$('.c-wfdecision__item').map(function (e) { return e.textContent; }),
                            comments: $$('.c-wfcomment article').map(function (e) {
                                var body = e.querySelector('div');
                                var d = String(e.querySelector('.c-wfcomment__item-date').textContent)
                                    .trim().split(/[. :]/g).map(function (n) { return parseInt(n); });
                                var ref = e.querySelector('.c-wfcomment__item-subheader-content');
                                return utils_1.removeValues({
                                    ref: ref ? String(ref.textContent).trim() : undefined,
                                    html: body.innerHTML.trim(),
                                    text: body.textContent.trim(),
                                    createdAt: new Date(d[2], d[1] - 1, d[0], d[4] + 2, d[5])
                                });
                            })
                        });
                        this.sources.add('details');
                        return [2 /*return*/, this];
                }
            });
        });
    };
    /**
     * Fetch wikifolio price
     */
    Wikifolio.prototype.price = function (ignoreCache) {
        if (ignoreCache === void 0) { ignoreCache = false; }
        return __awaiter(this, void 0, void 0, function () {
            var res, ask, bid, quantityLimitBid, quantityLimitAsk, calculationDate, validUntilDate, midPrice, showMidPrice, currency, isCurrencyConverted, isTicking;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.sources.has('price') && !ignoreCache)
                            return [2 /*return*/, this];
                        return [4 /*yield*/, this.fetch('id')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.api.request("api/wikifolio/" + this.id + "/price")];
                    case 2:
                        res = (_a.sent()) || {};
                        if (!res.ask)
                            console.warn('Could not retrieve price for', this.symbol);
                        ask = res.ask, bid = res.bid, quantityLimitBid = res.quantityLimitBid, quantityLimitAsk = res.quantityLimitAsk, calculationDate = res.calculationDate, validUntilDate = res.validUntilDate, midPrice = res.midPrice, showMidPrice = res.showMidPrice, currency = res.currency, isCurrencyConverted = res.isCurrencyConverted, isTicking = res.isTicking;
                        this.set({
                            ask: ask, bid: bid, quantityLimitBid: quantityLimitBid, quantityLimitAsk: quantityLimitAsk, midPrice: midPrice, showMidPrice: showMidPrice, currency: currency, isCurrencyConverted: isCurrencyConverted, isTicking: isTicking,
                            priceCalculatedAt: new Date(calculationDate),
                            priceValidUntil: new Date(validUntilDate)
                        });
                        this.sources.add('price');
                        return [2 /*return*/, this];
                }
            });
        });
    };
    /**
     * Wikifolio download
     */
    Wikifolio.prototype.download = function (type, from, to) {
        if (type === void 0) { type = 'daily'; }
        if (from === void 0) { from = new Date; }
        if (to === void 0) { to = new Date; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetch('symbol')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.api.request("dynamic/de/de/invest/download" + utils_1.toQueryString({
                                type: type,
                                name: this.symbol,
                                datefrom: utils_1.fromDate(from),
                                dateto: utils_1.fromDate(to)
                            }))];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Fetch portfolio
     */
    Wikifolio.prototype.portfolio = function () {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetch('symbol')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.api.request("api/wikifolio/" + this.symbol + "/portfolio" + utils_1.toQueryString({
                                country: this.api.opt.locale[0],
                                language: this.api.opt.locale[1]
                            }))];
                    case 2:
                        res = _a.sent();
                        this.isSuper = res.isSuperWikifolio;
                        this.currency = res.currency;
                        return [2 /*return*/, new _1.Portfolio(__assign(__assign({}, res), { isSuper: this.isSuper }), this)];
                }
            });
        });
    };
    /**
     * Loads performance information
     */
    Wikifolio.prototype.analysis = function (_a) {
        if (_a === void 0) { _a = {}; }
        var ignoreCache = _a.ignoreCache, param = __rest(_a, ["ignoreCache"]);
        return __awaiter(this, void 0, void 0, function () {
            var l;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.sources.has('analysis') && !ignoreCache)
                            return [2 /*return*/, this];
                        return [4 /*yield*/, this.fetch('id')];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.api.request("api/wikifolio/" + this.id + "/analysis" + utils_1.toQueryString(__assign({ country: this.api.opt.locale[0], language: this.api.opt.locale[1] }, param)))];
                    case 2:
                        l = (_b.sent()).analysis.keyFigures;
                        this.set({
                            rank: utils_1.toFloat(l.find(function (i) { return i.label === 'Top-wikifolio-Rangliste'; }).value),
                            maxdraw: utils_1.toFloat(l.find(function (i) { return i.label === 'Maximaler Verlust (bisher)'; }).value),
                            perf52weekHigh: utils_1.toFloat(l.find(function (i) { return i.label == '52-Wochen-Hoch'; }).value),
                            sharperatio: utils_1.toFloat(l.find(function (i) { return i.label === 'Sharpe Ratio'; }).value),
                            perfever: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance seit Beginn'; }).value),
                            perfemission: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance seit Emission'; }).value),
                            perfytd: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance seit Jahresbeginn'; }).value),
                            perfannually: utils_1.toFloat(l.find(function (i) { return i.label === 'Ø-Performance pro Jahr'; }).value),
                            perf12m: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance 1 Jahr'; }).value),
                            perf6m: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance 6 Monate'; }).value),
                            perf3m: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance 3 Monate'; }).value),
                            perf1m: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance 1 Monat'; }).value),
                            perfintra: utils_1.toFloat(l.find(function (i) { return i.label === 'Performance Intraday'; }).value),
                        });
                        this.sources.add('analysis');
                        return [2 /*return*/, this];
                }
            });
        });
    };
    /**
     * Fetches Trade[] sorted by date
     */
    Wikifolio.prototype.trades = function (param) {
        if (param === void 0) { param = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, pageCount, isSuperWikifolio, orders, trades;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.fetch('id')];
                    case 1:
                        _b.sent();
                        return [4 /*yield*/, this.api.request("api/wikifolio/" + this.id + "/tradehistory" + utils_1.toQueryString(__assign({ page: 0, pageSize: this.api.opt.defaults.pageSize, country: this.api.opt.locale[0], language: this.api.opt.locale[1] }, param)))];
                    case 2:
                        _a = (_b.sent()).tradeHistory, pageCount = _a.pageCount, isSuperWikifolio = _a.isSuperWikifolio, orders = _a.orders;
                        this.isSuper = isSuperWikifolio;
                        trades = orders.map(function (order) { return new _1.Trade(utils_1.removeValues(order, null), _this); });
                        return [2 /*return*/, {
                                pageCount: pageCount,
                                trades: trades
                            }];
                }
            });
        });
    };
    // /**
    //  * Fetch sustainability
    //  */
    // public async sustainability(): Promise<void> {
    // 	console.error('Not yet implemented')
    // }
    Wikifolio.prototype.history = function (_a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.useDate, useDate = _c === void 0 ? true : _c, _d = _b.generateArray, generateArray = _d === void 0 ? true : _d, _e = _b.generateObject, generateObject = _e === void 0 ? false : _e;
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0: return [4 /*yield*/, this.fetch('id')];
                    case 1:
                        _f.sent();
                        return [4 /*yield*/, this.api.request({
                                url: _1.Api.url + "api/chart/" + this.id + "/indexhistory",
                                method: 'get'
                            })];
                    case 2:
                        data = _f.sent();
                        if (generateArray) {
                            data.array = data.timestamps.map(function (ts, i) { return [ts, data.values[i]]; });
                        }
                        if (generateObject) {
                            data.object = data.timestamps.reduce(function (a, v, i) {
                                var _a;
                                return (__assign(__assign({}, a), (_a = {}, _a[v] = data.values[i], _a)));
                            }, {});
                        }
                        if (useDate) {
                            data.dates = data.timestamps.map(function (ts) { return utils_1.toDate(ts); });
                            data.creationDate = utils_1.toDate(data.creationDate);
                            data.publishDate = utils_1.toDate(data.publishDate);
                            data.todaysFirstTick = data.todaysFirstTick === null ? data.todaysFirstTick : utils_1.toDate(data.todaysFirstTick);
                        }
                        return [2 /*return*/, data];
                }
            });
        });
    };
    /**
     * Toggle watchlist status of wikifolio
     */
    Wikifolio.prototype.watchlist = function (add) {
        if (add === void 0) { add = true; }
        return __awaiter(this, void 0, void 0, function () {
            var success;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetch('id')];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.api.request({
                                url: _1.Api.url + "dynamic/en/int/watchlistwikifolio/" + (add ? 'addwikifoliotowatchlist' : 'removewikifoliofromwatchlist'),
                                method: 'post',
                                json: { wikifolioId: this.id }
                            })];
                    case 2:
                        success = (_a.sent()).success;
                        return [2 /*return*/, success];
                }
            });
        });
    };
    /**
     * Get order
     */
    Wikifolio.prototype.order = function (id) {
        return _1.Order.instance(this.api, this, id);
    };
    /**
     * Returns open trades of a wikifolio
     */
    Wikifolio.prototype.orders = function (param) {
        if (param === void 0) { param = {}; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetch('id')];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, _1.Order.list(this.api, this, param)];
                }
            });
        });
    };
    /**
     * Place wikifolio order
     */
    Wikifolio.prototype.trade = function (order) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.fetch('id', 'isOwned')];
                    case 1:
                        _a.sent();
                        if (!this.isOwned)
                            throw new Error('Can\'t place order in foreign wikifolio');
                        return [4 /*yield*/, new _1.Order({}, this, this.api).submit(order)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Place a buy order
     */
    Wikifolio.prototype.buy = function (order) {
        return this.trade(__assign(__assign({}, order), { buysell: 'buy' }));
    };
    /**
     * Place a sell order
     */
    Wikifolio.prototype.sell = function (order) {
        return this.trade(__assign(__assign({}, order), { buysell: 'sell' }));
    };
    Wikifolio.instances = {};
    return Wikifolio;
}());
exports.Wikifolio = Wikifolio;
//# sourceMappingURL=Wikifolio.js.map