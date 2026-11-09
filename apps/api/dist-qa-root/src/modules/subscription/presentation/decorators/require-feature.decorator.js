"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequireFeature = exports.REQUIRED_FEATURES_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.REQUIRED_FEATURES_KEY = 'auth:requiredFeatures';
const RequireFeature = (...features) => (0, common_1.SetMetadata)(exports.REQUIRED_FEATURES_KEY, features);
exports.RequireFeature = RequireFeature;
//# sourceMappingURL=require-feature.decorator.js.map