"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
const common_1 = require("@nestjs/common");
const exception_codes_enum_1 = require("./exception-codes.enum");
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = common_1.HttpStatus.INTERNAL_SERVER_ERROR, code = exception_codes_enum_1.ExceptionCode.INTERNAL_ERROR, details) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
    static badRequest(message, code = exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR, details) {
        return new AppError(message, common_1.HttpStatus.BAD_REQUEST, code, details);
    }
    static unauthorized(message = 'Unauthorized', code = exception_codes_enum_1.ExceptionCode.UNAUTHORIZED) {
        return new AppError(message, common_1.HttpStatus.UNAUTHORIZED, code);
    }
    static forbidden(message = 'Forbidden', code = exception_codes_enum_1.ExceptionCode.FORBIDDEN) {
        return new AppError(message, common_1.HttpStatus.FORBIDDEN, code);
    }
    static notFound(message = 'Resource not found', code = exception_codes_enum_1.ExceptionCode.NOT_FOUND) {
        return new AppError(message, common_1.HttpStatus.NOT_FOUND, code);
    }
    static internal(message = 'An unexpected error occurred', details) {
        return new AppError(message, common_1.HttpStatus.INTERNAL_SERVER_ERROR, exception_codes_enum_1.ExceptionCode.INTERNAL_ERROR, details);
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app.error.js.map