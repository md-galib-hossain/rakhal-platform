"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Authorize = void 0;
const require_permission_decorator_1 = require("./require-permission.decorator");
const Authorize = (...permissions) => (0, require_permission_decorator_1.RequirePermission)(...permissions);
exports.Authorize = Authorize;
//# sourceMappingURL=authorize.decorator.js.map