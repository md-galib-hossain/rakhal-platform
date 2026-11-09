import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionAccessService } from '../../application/services/subscription-access.service';
export declare class SubscriptionFeatureGuard implements CanActivate {
    private readonly reflector;
    private readonly subscriptionAccessService;
    constructor(reflector: Reflector, subscriptionAccessService: SubscriptionAccessService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
