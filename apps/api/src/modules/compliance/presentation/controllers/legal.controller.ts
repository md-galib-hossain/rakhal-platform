import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { LegalConsentService } from '../../application/services/legal-consent.service';
import { RecordConsentDto } from '../dto/record-consent.dto';

/**
 * Legal consent (RAKHAL-236, PRD §36.1). `/api/v1/legal`. `GET /documents` is
 * **public** (a pre-login user can read the ToS/Privacy); consent status +
 * recording require a signed-in user (no farm context — consent is per-user).
 */
@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly legal: LegalConsentService) {}

  /** Current published Terms of Service + Privacy Policy. Public. */
  @Get('documents')
  documents() {
    return this.legal.getCurrentDocuments();
  }

  @Get('consent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard)
  status(@CurrentUserId() userId: string) {
    return this.legal.getConsentStatus(userId);
  }

  @Post('consent')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, SessionGuard)
  accept(
    @CurrentUserId() userId: string,
    @Body() dto: RecordConsentDto,
    @Req() req: Request,
  ) {
    return this.legal.recordConsent(userId, dto.documentIds ?? [], req.ip);
  }
}
