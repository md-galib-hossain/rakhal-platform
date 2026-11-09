"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRefreshCookieOptions = getRefreshCookieOptions;
exports.getClearRefreshCookieOptions = getClearRefreshCookieOptions;
exports.getCsrfCookieOptions = getCsrfCookieOptions;
function getRefreshCookieOptions(config) {
    return {
        httpOnly: true,
        secure: config.refreshCookie.secure,
        sameSite: config.refreshCookie.sameSite,
        domain: config.refreshCookie.domain,
        path: config.refreshCookie.path,
        maxAge: parseDurationToMs(config.refreshExpiresIn),
    };
}
function getClearRefreshCookieOptions(config) {
    const options = getRefreshCookieOptions(config);
    delete options.maxAge;
    return options;
}
function getCsrfCookieOptions(config) {
    return {
        httpOnly: false,
        secure: config.csrf.cookieSecure,
        sameSite: config.csrf.cookieSameSite,
        path: config.csrf.cookiePath,
    };
}
function parseDurationToMs(value) {
    const match = /^(?<amount>\d+)(?<unit>ms|s|m|h|d)$/i.exec(value.trim());
    if (!match?.groups) {
        return undefined;
    }
    const amount = Number(match.groups.amount);
    const unit = match.groups.unit.toLowerCase();
    const multipliers = {
        ms: 1,
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
    };
    return amount * multipliers[unit];
}
//# sourceMappingURL=auth-cookie-options.js.map