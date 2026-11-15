import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CsrfService } from '../../application/services/csrf.service';
import { AuthenticatedHttpRequest } from '../../domain/authenticated-http-request.type';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request>() as AuthenticatedHttpRequest;

    // Native clients send no refresh cookie and authenticate explicitly (bearer
    // or body token), so there is no ambient credential for CSRF to protect.
    if (this.csrfService.isCookielessClient(request)) {
      return true;
    }

    if (!this.csrfService.validateRequest(request)) {
      throw new ForbiddenException('invalid csrf token');
    }

    return true;
  }
}
