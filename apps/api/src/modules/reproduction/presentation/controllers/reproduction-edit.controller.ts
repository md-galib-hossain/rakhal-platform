import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { ReproductionEditService } from '../../application/services/reproduction-edit.service';
import { ReproductionCalvingEditService } from '../../application/services/reproduction-calving-edit.service';
import { EditHeatEventDto } from '../dto/edit-heat-event.dto';
import { EditBreedingEventDto } from '../dto/edit-breeding-event.dto';
import { EditPregnancyDiagnosisDto } from '../dto/edit-pregnancy-diagnosis.dto';
import { EditAbortionEventDto } from '../dto/edit-abortion-event.dto';
import { EditDryOffDto } from '../dto/edit-dry-off.dto';
import { EditCalvingEventDto } from '../dto/edit-calving-event.dto';

/**
 * RAKHAL-305: edit routes for the five correctable event types. `/api/v1/reproduction`.
 * Manager+ only (`reproduction.update` — Worker's grant is `reproduction.heat` only).
 */
@ApiTags('Reproduction')
@ApiBearerAuth()
@Controller('reproduction')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class ReproductionEditController {
  constructor(
    private readonly editService: ReproductionEditService,
    private readonly calvingEditService: ReproductionCalvingEditService,
  ) {}

  @Patch('heat-events/:id')
  @RequirePermission('reproduction.update')
  editHeatEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EditHeatEventDto,
  ) {
    return this.editService.editHeatEvent(farmId, userId, id, dto);
  }

  @Patch('breeding-events/:id')
  @RequirePermission('reproduction.update')
  editBreedingEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EditBreedingEventDto,
  ) {
    return this.editService.editBreedingEvent(farmId, userId, id, dto);
  }

  @Patch('pregnancy-diagnoses/:id')
  @RequirePermission('reproduction.update')
  editPregnancyDiagnosis(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EditPregnancyDiagnosisDto,
  ) {
    return this.editService.editPregnancyDiagnosis(farmId, userId, id, dto);
  }

  @Patch('abortion-events/:id')
  @RequirePermission('reproduction.update')
  editAbortionEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EditAbortionEventDto,
  ) {
    return this.editService.editAbortionEvent(farmId, userId, id, dto);
  }

  @Patch('dry-off/:id')
  @RequirePermission('reproduction.update')
  editDryOff(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EditDryOffDto,
  ) {
    return this.editService.editDryOff(farmId, userId, id, dto);
  }

  @Patch('calving-events/:id')
  @RequirePermission('reproduction.update')
  editCalvingEvent(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: EditCalvingEventDto,
  ) {
    return this.calvingEditService.editCalvingEvent(farmId, userId, id, dto);
  }
}
