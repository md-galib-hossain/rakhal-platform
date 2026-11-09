import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantAccessService } from '../../application/services/tenant-access.service';
export declare class FarmMembershipGuard implements CanActivate {
    private readonly reflector;
    private readonly tenantAccessService;
    constructor(reflector: Reflector, tenantAccessService: TenantAccessService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
