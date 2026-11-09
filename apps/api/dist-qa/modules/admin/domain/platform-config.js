"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SETTING_JSON_BYTES = exports.CONFIG_KEY_PATTERN = void 0;
exports.looksLikeSecretKey = looksLikeSecretKey;
exports.settingValueProblem = settingValueProblem;
exports.isFeatureEnabled = isFeatureEnabled;
exports.CONFIG_KEY_PATTERN = /^[a-z][a-z0-9_.-]{2,63}$/;
exports.MAX_SETTING_JSON_BYTES = 4000;
const SECRET_LOOKING_KEY = /pass(word)?|secret|token|credential|private|api[_.-]?key|(^|[_.-])key($|[_.-])/i;
function looksLikeSecretKey(key) {
    return SECRET_LOOKING_KEY.test(key);
}
function settingValueProblem(value) {
    if (value === undefined)
        return 'value is required';
    let json;
    try {
        json = JSON.stringify(value);
    }
    catch {
        return 'value must be JSON-serialisable';
    }
    if (json === undefined)
        return 'value must be JSON-serialisable';
    if (Buffer.byteLength(json, 'utf8') > exports.MAX_SETTING_JSON_BYTES) {
        return `value must be at most ${exports.MAX_SETTING_JSON_BYTES} bytes of JSON`;
    }
    return null;
}
function isFeatureEnabled(flag, farmId) {
    if (!flag)
        return false;
    if (flag.enabled)
        return true;
    return !!farmId && flag.farmIds.includes(farmId);
}
//# sourceMappingURL=platform-config.js.map