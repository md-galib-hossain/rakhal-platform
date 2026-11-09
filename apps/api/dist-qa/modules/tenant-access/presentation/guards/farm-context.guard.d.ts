import { CanActivate, ExecutionContext } from '@nestjs/common';
import { TenantAccessService } from '../../application/services/tenant-access.service';
export declare class FarmContextGuard implements CanActivate {
    private readonly tenantAccessService;
    constructor(tenantAccessService: TenantAccessService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
