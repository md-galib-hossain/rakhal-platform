import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { REQUIRED_FEATURES_KEY } from '../decorators/require-feature.decorator';
import { SubscriptionAccessService } from '../subscription-access.service';

@Injectable()
export class SubscriptionFeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionAccessService: SubscriptionAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeatures =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_FEATURES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredFeatures.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request>() as AuthenticatedHttpRequest;

    if (!request.farm) {
      throw new ForbiddenException('Feature is not enabled');
    }

    for (const feature of requiredFeatures) {
      await this.subscriptionAccessService.assertFeatureEnabled(
        request.farm.farmId,
        feature,
      );
    }

    return true;
  }
}
