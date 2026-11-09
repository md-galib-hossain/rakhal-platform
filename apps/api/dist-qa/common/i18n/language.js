"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LANGUAGE = void 0;
exports.isAppLanguage = isAppLanguage;
exports.resolveLanguage = resolveLanguage;
exports.DEFAULT_LANGUAGE = 'bn';
const SUPPORTED_LANGUAGES = ['bn', 'en'];
function isAppLanguage(value) {
    return (typeof value === 'string' &&
        SUPPORTED_LANGUAGES.includes(value));
}
function resolveLanguage(acceptLanguageHeader, preferredLanguage) {
    const fromHeader = parseAcceptLanguage(acceptLanguageHeader);
    if (fromHeader)
        return fromHeader;
    if (preferredLanguage && isAppLanguage(preferredLanguage)) {
        return preferredLanguage;
    }
    return exports.DEFAULT_LANGUAGE;
}
function parseAcceptLanguage(header) {
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw)
        return undefined;
    const tags = raw
        .split(',')
        .map((part) => {
        const [tag, ...params] = part.trim().split(';');
        const qParam = params.find((p) => p.trim().startsWith('q='));
        const q = qParam ? Number(qParam.trim().slice(2)) : 1;
        return { primary: tag.trim().split('-')[0].toLowerCase(), q };
    })
        .sort((a, b) => b.q - a.q);
    for (const { primary } of tags) {
        if (isAppLanguage(primary))
            return primary;
    }
    return undefined;
}
//# sourceMappingURL=language.js.map