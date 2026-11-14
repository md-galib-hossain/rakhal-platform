import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { MediaService } from '../../application/services/media.service';

/**
 * Media (RAKHAL-009). `/api/v1/media`. Farm chain + RBAC. Reads only — uploads
 * are done through the owning entity's endpoint (e.g. `POST /cattle/:id/photo`)
 * so the entity's own permission governs the write. This endpoint hands back a
 * fresh presigned URL (for refreshing an expired one), farm-scoped.
 */
@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get(':id/url')
  @RequirePermission('media.read')
  url(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.media.presentUrls(farmId, id, true);
  }
}
