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
import { ReproductionService } from '../../application/services/reproduction.service';

@Controller('cattle')
@UseGuards(JwtAuthGuard, SessionGuard)
export class CattleReproductionController {
  constructor(private readonly reproductionService: ReproductionService) {}

  @Get(':id/reproduction-summary')
  summary(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.reproductionService.summary(this.userId(request), id);
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    return userId;
  }
}
