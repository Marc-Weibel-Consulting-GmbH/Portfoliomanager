"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.got = exports.JSDOM = exports.matchResult = exports.removeValues = exports.toQueryString = exports.toCurrency = exports.toInt = exports.toFloat = exports.fromDate = exports.toDate = exports.toType = exports.parseHtml = void 0;
var jsdom_1 = require("jsdom");
Object.defineProperty(exports, "JSDOM", { enumerable: true, get: function () { return jsdom_1.JSDOM; } });
var got_1 = require("got");
exports.got = got_1.default;
var emptyValues = ['', '-', 'N/A'];
function parseHtml(html) {
    var window = new jsdom_1.JSDOM(html).window;
    var document = window.document;
    return { html: html, window: window, document: document,
        $: function (selector, parent) {
            if (parent === void 0) { parent = document; }
            return parent.querySelector(selector);
        },
        $$: function (selector, parent) {
            if (parent === void 0) { parent = document; }
            return Array.from(parent.querySelectorAll(selector));
        },
        attribute: function (selector, attr) { return document.querySelector(selector)[attr]; }, string: get.bind(null, document, 'string'),
        int: get.bind(null, document, 'int'),
        float: get.bind(null, document, 'float'),
        date: get.bind(null, document, 'date'),
        currency: get.bind(null, document, 'currency') };
}
exports.parseHtml = parseHtml;
function get(document, type, selector, parent) {
    if (type === void 0) { type = 'string'; }
    var text;
    try {
        text = (parent || document).querySelector(selector).textContent.replace(/\s\s+/g, ' ').trim();
    }
    catch (e) {
        return undefined;
    }
    return toType(text, type);
}
function formatNumber(string) {
    return String(string).replace(/\./g, '').replace(',', '.');
}
function toType(val, type) {
    switch (type) {
        case 'string': return String(val).trim();
        case 'int': return toInt(val);
        case 'float': return toFloat(val);
        case 'date': return toDate(val);
        case 'currency': return toCurrency(val);
        default: return val;
    }
}
exports.toType = toType;
function toDate(val) {
    if (val === undefined || emptyValues.includes(val))
        return undefined;
    var p;
    if (val.includes('T')) {
        return new Date(parseInt(val.substr(0, 4)), parseInt(val.substr(4, 2)) - 1, parseInt(val.substr(6, 2)), parseInt(val.substr(9, 2)), parseInt(val.substr(11, 2)));
    }
    if (val.includes('.')) {
        p = val.split('.');
        return new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]), 1);
    }
    return undefined;
}
exports.toDate = toDate;
function fromDate(d, type) {
    switch (type) {
        default:
            var _a = [d.getDate(), d.getMonth() + 1], date = _a[0], month = _a[1];
            return (date < 10 ? '0' : '') + date + '.' + (month < 10 ? '0' : '') + month + '.' + d.getFullYear();
    }
}
exports.fromDate = fromDate;
function toFloat(val) {
    if (val === undefined || emptyValues.includes(val))
        return undefined;
    return parseFloat(formatNumber(val));
}
exports.toFloat = toFloat;
function toInt(val) {
    if (val === undefined)
        return undefined;
    return parseInt(formatNumber(val));
}
exports.toInt = toInt;
function toCurrency(val) {
    if (val === undefined || emptyValues.includes(val))
        return undefined;
    return parseFloat(formatNumber(val.startsWith('EUR ') ? val.substr(4) : val));
}
exports.toCurrency = toCurrency;
function toQueryString(obj, prefix, encode) {
    if (prefix === void 0) { prefix = '?'; }
    if (encode === void 0) { encode = 'none'; }
    if (!obj)
        return '';
    var r = Object.keys(obj)
        .map(function (key) { return obj[key] &&
        (['all', 'keys'].includes(encode) ? encodeURIComponent(key) : key)
            + '='
            + (['all', 'values'].includes(encode) ? encodeURIComponent(obj[key]) : obj[key]); })
        .filter(function (obj) { return obj; })
        .join('&');
    return r && prefix ? prefix + r : r || '';
}
exports.toQueryString = toQueryString;
function removeValues(obj) {
    var values = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        values[_i - 1] = arguments[_i];
    }
    Object.keys(obj).forEach(function (key) { return ((!values.length && obj[key] === undefined) || values.includes(obj[key])) && delete obj[key]; });
    return obj;
}
exports.removeValues = removeValues;
function matchResult(regexp, string, emptyValue) {
    if (emptyValue === void 0) { emptyValue = undefined; }
    var res = regexp.exec(string);
    if (!res)
        return emptyValue;
    return res[1];
}
exports.matchResult = matchResult;
//# sourceMappingURL=utils.js.map