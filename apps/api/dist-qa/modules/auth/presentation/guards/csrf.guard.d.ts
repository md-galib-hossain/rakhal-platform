import { CanActivate, ExecutionContext } from '@nestjs/common';
import { CsrfService } from '../../application/services/csrf.service';
export declare class CsrfGuard implements CanActivate {
    private readonly csrfService;
    constructor(csrfService: CsrfService);
    canActivate(context: ExecutionContext): boolean;
}
