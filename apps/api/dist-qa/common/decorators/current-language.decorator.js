"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentLanguage = void 0;
const common_1 = require("@nestjs/common");
const language_1 = require("src/common/i18n/language");
exports.CurrentLanguage = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    return (0, language_1.resolveLanguage)(request.headers['accept-language'], request.auth?.account.preferredLanguage);
});
//# sourceMappingURL=current-language.decorator.js.map