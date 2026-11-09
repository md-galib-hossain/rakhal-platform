import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionAccessService } from '../../application/services/subscription-access.service';
export declare class SubscriptionGuard implements CanActivate {
    private readonly reflector;
    private readonly access;
    constructor(reflector: Reflector, access: SubscriptionAccessService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private blockMessage;
}
