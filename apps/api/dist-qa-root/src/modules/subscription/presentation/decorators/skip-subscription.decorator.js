"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipSubscription = exports.SKIP_SUBSCRIPTION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SKIP_SUBSCRIPTION_KEY = 'subscription:skip';
const SkipSubscription = () => (0, common_1.SetMetadata)(exports.SKIP_SUBSCRIPTION_KEY, true);
exports.SkipSubscription = SkipSubscription;
//# sourceMappingURL=skip-subscription.decorator.js.map