import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import { AdminHealthResponseDto } from '../dto/admin-system-response.dto';

/**
 * Liveness check for the `admin-api` surface (RAKHAL-225 scaffold). Public —
 * ops tooling/load balancers poll it without an admin session, matching the
 * conventional health-check pattern (no farm/tenant data ever touches it).
 */
@ApiTags('Admin — System')
@Controller('admin/health')
export class AdminHealthController {
  @Get()
  @ApiEnvelopeResponse(AdminHealthResponseDto)
  health() {
    return { status: 'ok' };
  }
}

// Compile-time guard (RD-140): the documented body must match what `health()` really returns.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type AdminHealthShapeGuards = [
  Assert<
    Same<ReturnType<AdminHealthController['health']>, AdminHealthResponseDto>
  >,
];
