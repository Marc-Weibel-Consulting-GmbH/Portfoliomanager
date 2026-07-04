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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Trade = void 0;
var _1 = require(".");
var utils_1 = require("../utils");
var buyTypes = ['Buy', 'BuyLimit'];
var sellTypes = ['Sell', 'SellLimit', 'StopLoss', 'SellStopLimit'];
var Trade = /** @class */ (function () {
    function Trade(trade, wikifolio) {
        if (trade === void 0) { trade = {}; }
        this.wikifolio = wikifolio;
        this.set(__assign(__assign({}, trade), { type: Trade.getType(trade.orderType), link: _1.Api.url + trade.link.substr(1), executedAt: new Date(trade.executionDate) }));
    }
    Trade.getType = function (orderType) {
        return buyTypes.includes(orderType) ? 'buy' : sellTypes.includes(orderType) ? 'sell' : 'other';
    };
    Trade.prototype.set = function (trade) {
        return Object.assign(this, utils_1.removeValues(trade));
    };
    return Trade;
}());
exports.Trade = Trade;
//# sourceMappingURL=Trade.js.map