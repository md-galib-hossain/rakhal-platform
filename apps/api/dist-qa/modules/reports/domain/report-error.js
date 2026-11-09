"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportError = void 0;
const enums_1 = require("./contracts/enums");
class ReportError extends Error {
    category;
    constructor(category, message) {
        super(message);
        this.category = category;
        this.name = 'ReportError';
    }
    get transient() {
        return (0, enums_1.isTransientError)(this.category);
    }
}
exports.ReportError = ReportError;
//# sourceMappingURL=report-error.js.map