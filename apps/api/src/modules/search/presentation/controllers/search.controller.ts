import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SearchService } from '../../application/services/search.service';
import { SearchQueryDto } from '../dto/search-query.dto';

/**
 * Global search (RAKHAL-257). `/api/v1/search`. Farm chain + RBAC. Gated by
 * `cattle.read` (every role that uses the app has it) — the searchable entities
 * are reference data (names/tags/contacts), not sensitive figures. Per-type RBAC
 * filtering is a future refinement.
 */
@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @RequirePermission('cattle.read')
  query(@CurrentFarmId() farmId: string, @Query() dto: SearchQueryDto) {
    return this.search.search(farmId, dto.q, dto.limit);
  }
}
