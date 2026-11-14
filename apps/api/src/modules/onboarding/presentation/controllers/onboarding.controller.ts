import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CurrentFarmId,
  CurrentUserId,
  ThrottleUpload,
} from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import {
  ImportConfirmDto,
  ImportPreviewDto,
} from 'src/modules/cattle/presentation/dto/import-cattle.dto';
import { OnboardingService } from '../../application/services/onboarding.service';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { ConfigureOnboardingDto } from '../dto/configure-onboarding.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Max CSV upload size for the onboarding cattle-import wrapper (PRD §5.3/§8.4), matches cattle.controller.ts. */
const CSV_MAX_BYTES = 5 * 1024 * 1024;

/** Onboarding (PRD §5.1 / API §2). `/api/v1/onboarding`. */
@ApiTags('Onboarding')
@ApiBearerAuth()
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  // ── Wizard steps (farm-scoped: the user is already a member) ───────────────

  @Get('status')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('settings.read')
  status(@CurrentFarmId() farmId: string) {
    return this.onboarding.status(farmId);
  }

  @Post('configure')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('settings.update')
  configure(
    @CurrentFarmId() farmId: string,
    @Body() dto: ConfigureOnboardingDto,
  ) {
    return this.onboarding.configure(farmId, dto);
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('settings.update')
  complete(@CurrentFarmId() farmId: string) {
    return this.onboarding.complete(farmId);
  }

  @Post('cattle/import')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('cattle.create')
  @ThrottleUpload()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: CSV_MAX_BYTES } }),
  )
  importCattlePreview(
    @CurrentFarmId() farmId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportPreviewDto,
  ) {
    return this.onboarding.importCattlePreview(farmId, file, dto.mapping);
  }

  @Post('cattle/import/confirm')
  @UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
  @RequirePermission('cattle.create')
  importCattleConfirm(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: ImportConfirmDto,
  ) {
    return this.onboarding.importCattleConfirm(farmId, userId, dto);
  }

  // ── Accept invite (pre-membership: authenticated, but no farm context yet) ─

  /** Unauthenticated — lets the accept page render before the invitee has an account. */
  @Get('invites/:token')
  previewInvite(@Param('token') token: string) {
    return this.onboarding.previewInvite(token);
  }

  @Post('accept-invite')
  @UseGuards(JwtAuthGuard, SessionGuard)
  acceptInvite(@CurrentUserId() userId: string, @Body() dto: AcceptInviteDto) {
    return this.onboarding.acceptInvite(userId, dto.token);
  }
}
