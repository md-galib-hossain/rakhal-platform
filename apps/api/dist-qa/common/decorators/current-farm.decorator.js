"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentFarmId = exports.CurrentFarm = void 0;
const common_1 = require("@nestjs/common");
exports.CurrentFarm = (0, common_1.createParamDecorator)((field, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const farm = request.farm;
    if (!farm) {
        throw new common_1.ForbiddenException('Farm access denied');
    }
    return field ? farm[field] : farm;
});
exports.CurrentFarmId = (0, common_1.createParamDecorator)((_data, ctx) => {
    const request = ctx.switchToHttp().getRequest();
    const farmId = request.farm?.farmId;
    if (!farmId) {
        throw new common_1.ForbiddenException('Farm access denied');
    }
    return farmId;
});
//# sourceMappingURL=current-farm.decorator.js.map