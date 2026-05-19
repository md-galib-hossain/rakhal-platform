import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { PermissionService } from '../../application/services/permission.service';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request>() as AuthenticatedHttpRequest;

    if (!request.auth || !request.farm) {
      throw new ForbiddenException('Permission denied');
    }

    await this.permissionService.assertPermissions(
      request.auth.user.sub,
      request.farm.farmId,
      request.auth.user.permissionsVersion,
      requiredPermissions,
    );

    return true;
  }
}
