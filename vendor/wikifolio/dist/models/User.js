"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
var _1 = require(".");
var utils_1 = require("../utils");
var User = /** @class */ (function () {
    function User(user, api) {
        if (user === void 0) { user = {}; }
        this.api = api;
        this.sources = new Set();
        this.watchlist = [];
        this.set(user);
    }
    User.instance = function (api, nickname) {
        return this.instances[nickname] = this.instances[nickname] || new User({ nickname: nickname }, api);
    };
    User.prototype.set = function (user) {
        return Object.assign(this, utils_1.removeValues(user));
    };
    /**
     * Fetch specific attributes (not in use yet)
     */
    User.prototype.fetch = function () {
        var attributes = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            attributes[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                // remove loaded attributes
                attributes = attributes.filter(function (a) { return !_this[a]; });
                if (attributes.includes('nickname')) {
                    throw new Error('Missing user.nickname');
                }
                return [2 /*return*/, this];
            });
        });
    };
    /**
     * Fetches User details from HTML (slow)
     */
    User.prototype.details = function (ignoreCache) {
        if (ignoreCache === void 0) { ignoreCache = false; }
        return __awaiter(this, void 0, void 0, function () {
            var profileUrl, _a, $, string, date, _b, id, $topWikifolio, topWikifolio;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (this.sources.has('details') && !ignoreCache)
                            return [2 /*return*/, this];
                        return [4 /*yield*/, this.fetch('nickname')];
                    case 1:
                        _c.sent();
                        profileUrl = this.api.opt.locale.join('/') + "/p/" + this.nickname;
                        _b = utils_1.parseHtml;
                        return [4 /*yield*/, this.api.request(profileUrl)];
                    case 2:
                        _a = _b.apply(void 0, [_c.sent()]), $ = _a.$, string = _a.string, date = _a.date;
                        id = JSON.parse($('#global-data').innerHTML).gtmData.userGtmId;
                        $topWikifolio = $('.c-wikifolio-card__card-url');
                        topWikifolio = _1.Wikifolio.instance(this.api, $topWikifolio.href.split('/').slice(-1)[0]);
                        topWikifolio.set({
                            title: $topWikifolio.querySelector('.c-icon-name__text').innerHTML.trim(),
                            perfever: utils_1.toFloat($topWikifolio.querySelector('.c-ranking-item__value').innerHTML),
                            perf12m: utils_1.toFloat($topWikifolio.querySelector('.c-ranking-item:nth-child(2) .c-ranking-item__value').innerHTML),
                            user: this,
                            sources: topWikifolio.sources.add('user.details')
                        });
                        this.set({
                            id: id,
                            nickname: string('.c-trader-name__text'),
                            name: string('.c-trader-profile__fullname'),
                            profileUrl: _1.Api.url + profileUrl.substr(1),
                            seenAt: date('.c-trader-profile__trader-info-item:nth-child(2) .u-fw-sb'),
                            registeredAt: date('.c-trader-profile__trader-info-item:nth-child(3) .u-fw-sb'),
                            topWikifolio: topWikifolio,
                            sources: this.sources.add('details')
                        });
                        return [2 /*return*/, this];
                }
            });
        });
    };
    User.prototype.wikifolios = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, groupedWikifolioCards, wikifoliosWatchlistedByUser;
            var _b;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.fetch('nickname')];
                    case 1:
                        _c.sent();
                        return [4 /*yield*/, this.api.request("api/profile/" + this.nickname + "/wikifolios?loadAllWikis=true")];
                    case 2:
                        _a = _c.sent(), groupedWikifolioCards = _a.groupedWikifolioCards, wikifoliosWatchlistedByUser = _a.wikifoliosWatchlistedByUser;
                        this.watchlist = wikifoliosWatchlistedByUser;
                        return [2 /*return*/, (_b = []).concat.apply(_b, Object.keys(groupedWikifolioCards).map(function (key) {
                                return groupedWikifolioCards[key].wikifolioResults.map(function (w) {
                                    var symbol = w.wikifolioLink.split('/').slice(-1)[0];
                                    return _1.Wikifolio.instance(_this.api, { symbol: symbol, id: w.id }).set({
                                        category: key,
                                        sources: new Set().add('user.wikifolios')
                                    });
                                });
                            }))];
                }
            });
        });
    };
    User.instances = {};
    return User;
}());
exports.User = User;
//# sourceMappingURL=User.js.map