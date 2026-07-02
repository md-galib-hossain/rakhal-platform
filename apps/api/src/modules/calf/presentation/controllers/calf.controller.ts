import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { CalfService } from '../../application/services/calf.service';
import { ListCalfQueryDto } from '../dto/list-calf-query.dto';
import { RecordColostrumDto } from '../dto/record-colostrum.dto';
import { RecordMilkFeedingDto } from '../dto/record-milk-feeding.dto';
import { RecordStarterFeedDto } from '../dto/record-starter-feed.dto';
import { RecordWeightDto } from '../dto/record-weight.dto';
import { WeanCalfDto } from '../dto/wean-calf.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Calf Management (PRD §14). `/api/v1/calves`. Token tenancy + RBAC. */
@ApiTags('Calf')
@ApiBearerAuth()
@Controller('calves')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard, PermissionGuard)
export class CalfController {
  constructor(private readonly calfService: CalfService) {}

  @Get()
  @RequirePermission('calf.read')
  list(@CurrentFarmId() farmId: string, @Query() query: ListCalfQueryDto) {
    return this.calfService.list(farmId, query);
  }

  @Get(':id')
  @RequirePermission('calf.read')
  profile(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.calfService.profile(farmId, id);
  }

  @Post(':id/colostrum')
  @RequirePermission('calf.log-feeding')
  colostrum(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RecordColostrumDto,
  ) {
    return this.calfService.recordColostrum(farmId, id, dto);
  }

  @Post(':id/milk-feeding')
  @RequirePermission('calf.log-feeding')
  milkFeeding(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RecordMilkFeedingDto,
  ) {
    return this.calfService.recordMilkFeeding(farmId, id, dto);
  }

  @Post(':id/weight')
  @RequirePermission('calf.log-feeding')
  weight(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: RecordWeightDto,
  ) {
    return this.calfService.recordWeight(farmId, userId, id, dto);
  }

  @Post(':id/starter-feed')
  @RequirePermission('calf.log-feeding')
  starterFeed(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: RecordStarterFeedDto,
  ) {
    return this.calfService.recordStarterFeed(farmId, id, dto);
  }

  @Post(':id/wean')
  @RequirePermission('calf.update')
  wean(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: WeanCalfDto,
  ) {
    return this.calfService.wean(farmId, id, dto);
  }
}
