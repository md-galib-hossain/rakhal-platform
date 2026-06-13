import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { HealthService } from '../../application/services/health.service';

@Controller('cattle')
@UseGuards(JwtAuthGuard, SessionGuard)
export class CattleHealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get(':id/health-summary')
  summary(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.healthService.getCattleHealthSummary(this.userId(request), id);
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) throw new UnauthorizedException('Unauthorized');
    return userId;
  }
}
