"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatFarmCode = formatFarmCode;
exports.deriveFarmPrefix = deriveFarmPrefix;
function formatFarmCode(prefix, year, serial) {
    return `${prefix}-${year}-${String(serial).padStart(3, '0')}`;
}
function deriveFarmPrefix(name) {
    const initials = name
        .split(/\s+/)
        .map((word) => word.replace(/[^a-zA-Z]/g, '').charAt(0))
        .filter(Boolean)
        .join('')
        .toUpperCase();
    return (initials || 'FARM').slice(0, 4);
}
//# sourceMappingURL=farm-code.js.map