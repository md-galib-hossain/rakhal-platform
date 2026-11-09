"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAlreadyExistsException = exports.UserNotFoundException = void 0;
const common_1 = require("@nestjs/common");
const base_exception_1 = require("./base.exception");
const exception_codes_enum_1 = require("./exception-codes.enum");
class UserNotFoundException extends base_exception_1.BaseException {
    constructor(identifier) {
        super({
            code: exception_codes_enum_1.ExceptionCode.USER_NOT_FOUND,
            message: `User not found: ${identifier}`,
            statusCode: common_1.HttpStatus.NOT_FOUND,
        });
    }
}
exports.UserNotFoundException = UserNotFoundException;
class UserAlreadyExistsException extends base_exception_1.BaseException {
    constructor(email) {
        super({
            code: exception_codes_enum_1.ExceptionCode.USER_ALREADY_EXISTS,
            message: `User already exists with email: ${email}`,
            statusCode: common_1.HttpStatus.CONFLICT,
        });
    }
}
exports.UserAlreadyExistsException = UserAlreadyExistsException;
//# sourceMappingURL=business.exception.js.map