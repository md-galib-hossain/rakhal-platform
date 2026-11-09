"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toNumber = exports.toBoolean = exports.trimString = void 0;
const trimString = ({ value }) => typeof value === 'string' ? value.trim() : value;
exports.trimString = trimString;
const toBoolean = ({ value }) => {
    if (value === true || value === 'true')
        return true;
    if (value === false || value === 'false')
        return false;
    return value;
};
exports.toBoolean = toBoolean;
const toNumber = ({ value }) => {
    if (value === '' || value === null || value === undefined)
        return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
};
exports.toNumber = toNumber;
//# sourceMappingURL=transform.helpers.js.map