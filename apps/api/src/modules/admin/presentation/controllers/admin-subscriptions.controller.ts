import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ThrottleWrite } from 'src/common/decorators';
import { AdminSubscriptionsService } from '../../application/services/admin-subscriptions.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import {
  ActivateSubscriptionDto,
  CompSubscriptionDto,
  ExtendSubscriptionDto,
  SetPlanFeatureDto,
  SubscriptionActionDto,
  UpdatePlanDto,
} from '../dto/admin-subscription.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ApiEnvelopeResponse } from 'src/common/swagger/api-envelope';
import {
  AdminPlanDto,
  AdminPlanFeatureResponseDto,
  AdminPlanMatrixResponseDto,
  AdminSubscriptionActionResponseDto,
} from '../dto/admin-commercial-response.dto';

/**
 * Phase 6 commercial administration. Plan/feature edits need `plan.manage`; manual subscription operations
 * need `subscription.manage` (BILLING_ADMIN and SUPER_ADMIN). Every body carries a reason, and farm-targeted
 * actions a confirmation equal to the farm name.
 */
@ApiTags('Admin — Commercial')
@ApiBearerAuth()
@Controller('admin')
@ThrottleWrite()
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminSubscriptionsController {
  constructor(private readonly subs: AdminSubscriptionsService) {}

  @Get('plans/matrix')
  @ApiEnvelopeResponse(AdminPlanMatrixResponseDto)
  @RequireAdminPermission('plan.read')
  matrix() {
    return this.subs.matrix();
  }

  @Patch('plans/:id')
  @ApiEnvelopeResponse(AdminPlanDto)
  @RequireAdminPermission('plan.manage')
  updatePlan(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.subs.updatePlan(admin.id, id, dto);
  }

  @Put('plans/:id/features/:key')
  @ApiEnvelopeResponse(AdminPlanFeatureResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('plan.manage')
  setFeature(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Param('key') key: string,
    @Body() dto: SetPlanFeatureDto,
  ) {
    return this.subs.setPlanFeature(admin.id, id, key, dto);
  }

  @Post('farms/:id/subscription/activate')
  @ApiEnvelopeResponse(AdminSubscriptionActionResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('subscription.manage')
  activate(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: ActivateSubscriptionDto,
  ) {
    return this.subs.activate(admin.id, id, dto);
  }

  @Post('farms/:id/subscription/comp')
  @ApiEnvelopeResponse(AdminSubscriptionActionResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('subscription.manage')
  comp(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: CompSubscriptionDto,
  ) {
    return this.subs.comp(admin.id, id, dto);
  }

  @Post('farms/:id/subscription/extend')
  @ApiEnvelopeResponse(AdminSubscriptionActionResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('subscription.manage')
  extend(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: ExtendSubscriptionDto,
  ) {
    return this.subs.extend(admin.id, id, dto);
  }

  @Post('farms/:id/subscription/cancel')
  @ApiEnvelopeResponse(AdminSubscriptionActionResponseDto)
  @HttpCode(200)
  @RequireAdminPermission('subscription.manage')
  cancel(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: SubscriptionActionDto,
  ) {
    return this.subs.cancel(admin.id, id, dto);
  }
}
