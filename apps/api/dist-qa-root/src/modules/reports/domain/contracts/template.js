"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSubsetOfAllowed = isSubsetOfAllowed;
function isSubsetOfAllowed(selected, allowed) {
    const set = new Set(allowed);
    return selected.every((id) => set.has(id));
}
//# sourceMappingURL=template.js.map