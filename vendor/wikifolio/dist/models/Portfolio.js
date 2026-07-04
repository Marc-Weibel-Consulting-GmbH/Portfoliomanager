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
exports.Portfolio = void 0;
var _1 = require(".");
var utils_1 = require("../utils");
var groupType = {
    0: 'cash',
    610: 'bonds',
    620: 'equities',
    630: 'etfs',
    640: 'structured-products',
    650: 'wikifolio-certificates'
};
var Portfolio = /** @class */ (function () {
    function Portfolio(_a, wikifolio) {
        var groups = _a.groups, currency = _a.currency, totalValue = _a.totalValue, isSuper = _a.isSuper;
        this.wikifolio = wikifolio;
        this.groups = [];
        this.currency = currency;
        this.totalValue = totalValue;
        this.isSuper = isSuper;
        this.groups = groups.map(function (g) { return (__assign(__assign({}, g), { name: Portfolio.getGroupName(g.type), items: g.items.map(function (i) { return (__assign(__assign({}, i), { link: i.link.startsWith('http') ? i.link : _1.Api.url + i.link.substr(1) })); }) })); });
    }
    Portfolio.getGroupName = function (groupId) {
        return groupType[groupId] || 'n/a';
    };
    Portfolio.prototype.set = function (portfolio) {
        return Object.assign(this, utils_1.removeValues(portfolio));
    };
    Object.defineProperty(Portfolio.prototype, "items", {
        get: function () {
            var _a;
            return (_a = []).concat.apply(_a, this.groups.map(function (group) { return group.items; }));
        },
        enumerable: false,
        configurable: true
    });
    return Portfolio;
}());
exports.Portfolio = Portfolio;
//# sourceMappingURL=Portfolio.js.map