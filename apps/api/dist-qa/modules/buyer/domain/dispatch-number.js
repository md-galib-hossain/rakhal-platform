"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISPATCH_NUMBER_PREFIX = void 0;
exports.dispatchCounterScope = dispatchCounterScope;
exports.formatDispatchNumber = formatDispatchNumber;
exports.DISPATCH_NUMBER_PREFIX = 'DSP';
function dispatchCounterScope(farmId) {
    return `dispatch:${farmId}`;
}
function formatDispatchNumber(value) {
    return `${exports.DISPATCH_NUMBER_PREFIX}-${String(value).padStart(6, '0')}`;
}
//# sourceMappingURL=dispatch-number.js.map