import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Liveness check for the `admin-api` surface (RAKHAL-225 scaffold). Public —
 * ops tooling/load balancers poll it without an admin session, matching the
 * conventional health-check pattern (no farm/tenant data ever touches it).
 */
@ApiTags('Admin — System')
@Controller('admin/health')
export class AdminHealthController {
  @Get()
  health() {
    return { status: 'ok' };
  }
}
