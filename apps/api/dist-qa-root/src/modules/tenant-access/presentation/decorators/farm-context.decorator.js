"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FarmContext = exports.FARM_PARAM_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.FARM_PARAM_KEY = 'auth:farmParamKey';
const FarmContext = (paramName = 'farmId') => (0, common_1.SetMetadata)(exports.FARM_PARAM_KEY, paramName);
exports.FarmContext = FarmContext;
//# sourceMappingURL=farm-context.decorator.js.map