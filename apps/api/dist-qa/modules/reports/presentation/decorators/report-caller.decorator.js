"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Caller = void 0;
const common_1 = require("@nestjs/common");
exports.Caller = (0, common_1.createParamDecorator)((_data, ctx) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.auth?.user;
    if (!user)
        throw new common_1.UnauthorizedException('Unauthorized');
    const farm = req.farm;
    if (!farm)
        throw new common_1.ForbiddenException('Farm access denied');
    return {
        userId: user.sub,
        farmId: farm.farmId,
        permissionsVersion: user.permissionsVersion,
        roleName: farm.roleName,
        isSystemRole: farm.isSystemRole,
    };
});
//# sourceMappingURL=report-caller.decorator.js.map