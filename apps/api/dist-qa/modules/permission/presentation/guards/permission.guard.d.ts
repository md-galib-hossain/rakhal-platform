import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../../application/services/permission.service';
export declare class PermissionGuard implements CanActivate {
    private readonly reflector;
    private readonly permissionService;
    constructor(reflector: Reflector, permissionService: PermissionService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
