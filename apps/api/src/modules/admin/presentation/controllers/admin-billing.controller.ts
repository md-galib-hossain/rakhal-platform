import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommissionStatus, CouponStatus } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CouponService } from 'src/modules/billing/application/services/coupon.service';
import { ReferralService } from 'src/modules/billing/application/services/referral.service';
import { PlanCatalogueService } from 'src/modules/subscription/application/services/plan-catalogue.service';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';
import { AdminIssueCouponDto } from '../dto/admin-issue-coupon.dto';

/**
 * Platform-admin monetization console (RAKHAL-224, PRD §32.5). Every route is
 * behind `PlatformAdminGuard` (`admin-api`, distinct identity — a farm token
 * can't reach here). Wires the coupon (CPN-06) + referral + plan surfaces that
 * were built engine-first (RD-025/RD-026). The referral flagged-commission
 * approve/reject console is RAKHAL-231; this exposes the read + coupon lifecycle.
 */
@ApiTags('Admin — Billing')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(PlatformAdminGuard, AdminPermissionGuard)
export class AdminBillingController {
  constructor(
    private readonly coupons: CouponService,
    private readonly referrals: ReferralService,
    private readonly plans: PlanCatalogueService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get('plans')
  listPlans() {
    return this.plans.listPlans();
  }

  @Get('coupons')
  @RequireAdminPermission('coupon.read')
  listCoupons(@Query('status') status?: CouponStatus) {
    return this.coupons.list(status);
  }

  @Post('coupons')
  @RequireAdminPermission('coupon.manage')
  async issueCoupon(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: AdminIssueCouponDto,
    @Req() req: Request,
  ) {
    const coupon = await this.coupons.issue({
      code: dto.code,
      type: dto.type,
      value: dto.value,
      maxRedemptions: dto.maxRedemptions,
      perFarmLimit: dto.perFarmLimit,
      validFrom: new Date(dto.validFrom),
      validUntil: new Date(dto.validUntil),
      applicablePlanIds: dto.applicablePlanIds,
      minSpend: dto.minSpend,
    });
    await this.audit.record({
      adminId: admin.id,
      action: 'COUPON_ISSUED',
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code, maxRedemptions: coupon.maxRedemptions },
      ipAddress: req.ip,
    });
    return coupon;
  }

  @Post('coupons/:id/disable')
  @RequireAdminPermission('coupon.manage')
  async disableCoupon(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const coupon = await this.coupons.disable(id);
    await this.audit.record({
      adminId: admin.id,
      action: 'COUPON_DISABLED',
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: { code: coupon.code },
      ipAddress: req.ip,
    });
    return coupon;
  }

  @Get('referrals/commissions')
  @RequireAdminPermission('referral.read')
  listCommissions(@Query('status') status?: CommissionStatus) {
    return this.referrals.listAllCommissions(status);
  }
}
