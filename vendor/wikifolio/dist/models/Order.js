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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
var _1 = require(".");
var utils_1 = require("../utils");
var ws_1 = require("ws");
var rxjs_1 = require("rxjs");
var Order = /** @class */ (function () {
    function Order(order, wikifolio, api) {
        if (order === void 0) { order = {}; }
        this.wikifolio = wikifolio;
        this.api = api;
        this.children = [];
        this.sources = new Set();
        this.set(order);
    }
    Order.instance = function (api, wikifolio, id) {
        return this.instances[id] = this.instances[id] || new Order({ id: id }, wikifolio, api);
    };
    /**
     * List orders of a wikifolio
     */
    Order.list = function (api, wikifolio, param) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, $, $$, string, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _b = utils_1.parseHtml;
                        return [4 /*yield*/, api.request("dynamic/" + api.opt.locale.join('/') + "/Publish/GetPagedOpenTrades" + utils_1.toQueryString(__assign(__assign({ page: 0, pageSize: api.opt.defaults.pageSize }, param), { id: wikifolio.id })))];
                    case 1:
                        _a = _b.apply(void 0, [_c.sent()]), $ = _a.$, $$ = _a.$$, string = _a.string;
                        return [2 /*return*/, __spreadArrays($$('tr.parent-order.first-group-item')).map(function ($tr) {
                                var _a = $('.js-edit-trade-button', $tr).dataset, tradeAmount = _a.tradeAmount, orderBuysell = _a.orderBuysell, orderType = _a.orderType, limit = _a.limit, stopLimit = _a.stopLimit, description = _a.description, validUntil = _a.validUntil, tpLimit = _a.tpLimit, slLimit = _a.slLimit, slStop = _a.slStop;
                                var group = $tr.dataset.group;
                                var isin = string('.isin', $tr);
                                var expiresAt = utils_1.toDate(validUntil);
                                var order = Order.instance(api, wikifolio, $tr.dataset.id);
                                var children = $$(".parent-order:not(.first-group-item)[data-group=\"" + group + "\"]").map(function ($tr) {
                                    var dataset = $('.remove', $tr).dataset;
                                    var securityType = dataset.securityType;
                                    var stopPrice;
                                    var prices = $('td.numeric div', $tr).innerHTML.split('/');
                                    if (securityType === 'StopLoss')
                                        stopPrice = utils_1.toFloat(prices[0]);
                                    return Order.instance(api, wikifolio, $tr.dataset.id).set({
                                        group: group,
                                        parent: order,
                                        isin: isin,
                                        description: description,
                                        status: $('.status-text', $tr).textContent,
                                        stopPrice: stopPrice,
                                        securityType: securityType,
                                        expiresAt: expiresAt
                                    });
                                });
                                return order.set({
                                    group: group,
                                    isin: isin,
                                    description: description,
                                    amount: utils_1.toInt(tradeAmount),
                                    buysell: orderBuysell,
                                    orderType: orderType,
                                    status: $('span.status-text', $tr).textContent,
                                    limitPrice: utils_1.toFloat(limit),
                                    stopPrice: utils_1.toFloat(stopLimit),
                                    stopLossLimitPrice: utils_1.toFloat(slLimit),
                                    stopLossStopPrice: utils_1.toFloat(slStop),
                                    takeProfitLimitPrice: utils_1.toFloat(tpLimit),
                                    expiresAt: expiresAt,
                                    children: children,
                                    sources: new Set().add('wikifolio.orders')
                                });
                            })];
                }
            });
        });
    };
    Order.prototype.set = function (order) {
        return Object.assign(this, utils_1.removeValues(order));
    };
    /**
     * Place order
     */
    Order.prototype.submit = function (order) {
        return __awaiter(this, void 0, void 0, function () {
            var res, _a, _b, _c, _d, _e, _f, _g, success, orderGuid, reason;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _b = (_a = this.api).request;
                        _c = {
                            url: _1.Api.url + "api/virtualorder/placeorder",
                            method: 'post'
                        };
                        _d = utils_1.removeValues;
                        _e = [__assign(__assign({}, this), order)];
                        _f = { wikifolioId: this.wikifolio.id, validUntil: order.expiresAt instanceof Date ? order.expiresAt.toISOString() : order.expiresAt };
                        if (!(order.orderType === 'quote')) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.quoteId(order)];
                    case 1:
                        _g = _h.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        _g = undefined;
                        _h.label = 3;
                    case 3: return [4 /*yield*/, _b.apply(_a, [(_c.json = _d.apply(void 0, [__assign.apply(void 0, _e.concat([(_f.quoteId = _g, _f)]))]),
                                _c)])];
                    case 4:
                        res = _h.sent();
                        success = res.success, orderGuid = res.orderGuid, reason = res.reason;
                        if (!success)
                            throw new Error("Unable to submit order (" + (reason || 'n/a') + ")");
                        this.id = orderGuid;
                        return [2 /*return*/, this];
                }
            });
        });
    };
    /**
     * Remove order
     */
    Order.prototype.remove = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.api.request({
                            url: _1.Api.url + "dynamic/" + this.api.opt.locale.join('/') + "/publish/removevirtualorder",
                            method: 'post',
                            json: { order: this.id }
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    /**
     * Returns the quoteId required to place an order of type 'quote'
     */
    Order.prototype.quoteId = function (order) {
        return __awaiter(this, void 0, void 0, function () {
            var subject, base, ConnectionToken, _a, _b, ws;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        subject = new rxjs_1.Subject();
                        base = {
                            connectionData: "[{\"name\":\"livehub\"},{\"name\":\"quotehub\"}]"
                        };
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, this.api.request(this.api.opt.locale.join('/') + "/signalr/negotiate" + utils_1.toQueryString(base))];
                    case 1:
                        ConnectionToken = _b.apply(_a, [_c.sent()]).ConnectionToken;
                        base.connectionToken = encodeURIComponent(ConnectionToken);
                        base.transport = 'webSockets';
                        ws = new ws_1.WebSocket("wss://" + _1.Api.hostname + "/de/de/signalr/connect" + utils_1.toQueryString(base), {
                            headers: { Cookie: this.api.opt.cookie }
                        });
                        ws.on('error', function (err) { return console.error(err); });
                        ws.on('open', function () { return ws.send(JSON.stringify({
                            H: 'quotehub',
                            M: 'GetQuote',
                            A: [_this.wikifolio.id, order.underlyingIsin, order.amount, order.buysell === 'buy' ? 910 : 920],
                            I: 1
                        })); });
                        ws.on('message', function (message) {
                            var res = JSON.parse(message.toString());
                            if (!res.M || !res.M.length)
                                return;
                            var messages = res.M;
                            for (var _i = 0, messages_1 = messages; _i < messages_1.length; _i++) {
                                var message_1 = messages_1[_i];
                                var H = message_1.H, M = message_1.M, A = message_1.A;
                                if (H !== 'QuoteHub')
                                    continue;
                                switch (M) {
                                    default:
                                        console.warn('Unknown response from WebSocket:', H, M, A);
                                        break;
                                    case 'quoteCallback':
                                        subject.next(A[0].QuoteId);
                                        break;
                                    case 'quoteErrorCallback': throw new Error(A[0]);
                                }
                                subject.complete();
                                ws.close();
                            }
                        });
                        this.api.request("de/de/signalr/start" + utils_1.toQueryString(base)).then();
                        return [2 /*return*/, rxjs_1.firstValueFrom(subject.asObservable())];
                }
            });
        });
    };
    Order.instances = {};
    return Order;
}());
exports.Order = Order;
//# sourceMappingURL=Order.js.map