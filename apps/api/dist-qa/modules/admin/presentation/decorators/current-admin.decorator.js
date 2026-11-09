"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentAdmin = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentAdmin = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    if (!request.admin) {
        throw new Error('CurrentAdmin used without PlatformAdminGuard');
    }
    return request.admin;
});
//# sourceMappingURL=current-admin.decorator.js.map