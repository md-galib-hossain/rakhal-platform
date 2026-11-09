"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseException = void 0;
const common_1 = require("@nestjs/common");
class BaseException extends common_1.HttpException {
    code;
    details;
    constructor(meta) {
        super(meta.message, meta.statusCode);
        this.code = meta.code;
        this.details = meta.details;
    }
}
exports.BaseException = BaseException;
//# sourceMappingURL=base.exception.js.map