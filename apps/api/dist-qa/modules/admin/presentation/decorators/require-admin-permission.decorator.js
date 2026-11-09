"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuthenticatedOnly = exports.ADMIN_AUTHENTICATED_ONLY_KEY = exports.RequireAdminPermission = exports.ADMIN_PERMISSION_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.ADMIN_PERMISSION_KEY = 'admin_permission';
const RequireAdminPermission = (permission) => (0, common_1.SetMetadata)(exports.ADMIN_PERMISSION_KEY, permission);
exports.RequireAdminPermission = RequireAdminPermission;
exports.ADMIN_AUTHENTICATED_ONLY_KEY = 'admin_authenticated_only';
const AdminAuthenticatedOnly = () => (0, common_1.SetMetadata)(exports.ADMIN_AUTHENTICATED_ONLY_KEY, true);
exports.AdminAuthenticatedOnly = AdminAuthenticatedOnly;
//# sourceMappingURL=require-admin-permission.decorator.js.map