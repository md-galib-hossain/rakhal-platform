export declare const ADMIN_PERMISSION_KEY = "admin_permission";
export declare const RequireAdminPermission: (permission: string) => import("@nestjs/common").CustomDecorator<string>;
export declare const ADMIN_AUTHENTICATED_ONLY_KEY = "admin_authenticated_only";
export declare const AdminAuthenticatedOnly: () => import("@nestjs/common").CustomDecorator<string>;
