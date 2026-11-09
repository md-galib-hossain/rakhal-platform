"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventError = eventError;
exports.parsePayload = parsePayload;
const common_1 = require("@nestjs/common");
const exception_codes_enum_1 = require("src/common/exceptions/exception-codes.enum");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
function eventError(eventCode, message, extra = {}) {
    return new common_1.UnprocessableEntityException({
        code: exception_codes_enum_1.ExceptionCode.VALIDATION_ERROR,
        message,
        details: { eventCode, ...extra },
    });
}
async function parsePayload(cls, raw) {
    const dto = (0, class_transformer_1.plainToInstance)(cls, raw);
    const errors = await (0, class_validator_1.validate)(dto, {
        whitelist: true,
        forbidUnknownValues: false,
    });
    if (errors.length) {
        throw eventError('EVENT_PAYLOAD_INVALID', 'Event payload is invalid', {
            fields: errors.map((e) => ({
                field: e.property,
                errors: Object.values(e.constraints ?? {}),
            })),
        });
    }
    return dto;
}
//# sourceMappingURL=parse-payload.js.map