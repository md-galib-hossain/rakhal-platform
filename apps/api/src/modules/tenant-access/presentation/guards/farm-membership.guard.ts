import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { FARM_PARAM_KEY } from '../decorators/farm-context.decorator';
import { TenantAccessService } from '../../application/services/tenant-access.service';

@Injectable()
export class FarmMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantAccessService: TenantAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request>() as AuthenticatedHttpRequest;
    const userId = request.user?.sub;
    const farmParamKey =
      this.reflector.get<string>(FARM_PARAM_KEY, context.getHandler()) ??
      'farmId';
    const farmId = request.params?.[farmParamKey];

    if (!userId || typeof farmId !== 'string' || farmId.length === 0) {
      throw new ForbiddenException('Farm access denied');
    }

    request.farm = await this.tenantAccessService.resolveFarmContext(
      userId,
      farmId,
    );

    return true;
  }
}
