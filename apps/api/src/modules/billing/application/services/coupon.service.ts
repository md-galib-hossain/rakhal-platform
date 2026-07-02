import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Coupon,
  CouponStatus,
  CouponType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { computeCouponDiscount } from '../../domain/coupon-pricing';

export interface IssueCouponInput {
  code: string;
  type: CouponType;
  value: number;
  maxRedemptions: number;
  perFarmLimit?: number;
  validFrom: Date;
  validUntil: Date;
  applicablePlanIds?: string[];
  minSpend?: number;
}

export interface CouponReservation {
  couponId: string;
  discount: Prisma.Decimal;
}

/**
 * Coupon engine (RAKHAL-222, PRD §33.1). `issue`/`list`/`disable` are
 * platform-admin actions (CPN-06). They're plain service methods — no HTTP
 * controller yet, since `PlatformAdminGuard` doesn't exist until
 * RAKHAL-224/225; this mirrors the AQR admin-config seam (`AqrConfigService`)
 * of building the engine first and wiring the admin surface once the guard
 * lands. `reserve`/`recordRedemption` are called from inside
 * `BillingService.checkout`'s own transaction so the seat decrement, the
 * per-farm-once check, and the invoice commit atomically (CPN-01).
 */
@Injectable()
export class CouponService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(CouponService.name);
  }

  async issue(actorUserId: string, input: IssueCouponInput): Promise<Coupon> {
    const code = input.code.trim().toUpperCase();
    let coupon: Coupon;
    try {
      coupon = await this.prisma.coupon.create({
        data: {
          code,
          type: input.type,
          value: new Prisma.Decimal(input.value),
          maxRedemptions: input.maxRedemptions,
          perFarmLimit: input.perFarmLimit ?? 1,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          applicablePlanIds: input.applicablePlanIds ?? [],
          minSpend:
            input.minSpend != null ? new Prisma.Decimal(input.minSpend) : null,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Coupon code "${code}" already exists`);
      }
      throw err;
    }

    await this.audit.record({
      actorUserId,
      action: AuditAction.COUPON_ISSUED,
      entityType: 'Coupon',
      entityId: coupon.id,
      metadata: {
        code,
        type: input.type,
        maxRedemptions: input.maxRedemptions,
      },
    });
    this.log.info('Coupon issued', { couponId: coupon.id, code });
    return coupon;
  }

  list(status?: CouponStatus): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async disable(actorUserId: string, id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { status: CouponStatus.DISABLED },
    });
    await this.audit.record({
      actorUserId,
      action: AuditAction.COUPON_DISABLED,
      entityType: 'Coupon',
      entityId: id,
      metadata: { code: coupon.code },
    });
    this.log.info('Coupon disabled', { couponId: id, code: coupon.code });
    return updated;
  }

  /**
   * Validate a coupon and atomically reserve a seat (CPN-01..05) inside the
   * caller's transaction. Throws on any rule violation — the caller's
   * transaction then rolls the seat reservation back along with it. Does not
   * write `CouponRedemption` (the invoice doesn't exist yet); call
   * `recordRedemption` once it does.
   */
  async reserve(
    tx: Prisma.TransactionClient,
    params: {
      code: string;
      farmId: string;
      planId: string;
      subtotal: Prisma.Decimal;
      phoneVerifiedAt: Date | null;
    },
  ): Promise<CouponReservation> {
    const code = params.code.trim().toUpperCase();
    const coupon = await tx.coupon.findUnique({ where: { code } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    if (coupon.status !== CouponStatus.ACTIVE) {
      throw new ForbiddenException('Coupon is disabled');
    }
    const now = new Date();
    if (now < coupon.validFrom || now > coupon.validUntil) {
      throw new ForbiddenException('Coupon is not valid at this time');
    }
    if (
      coupon.applicablePlanIds.length > 0 &&
      !coupon.applicablePlanIds.includes(params.planId)
    ) {
      throw new ForbiddenException('Coupon does not apply to this plan');
    }
    if (coupon.minSpend && params.subtotal.lt(coupon.minSpend)) {
      throw new ForbiddenException(
        "Order total is below this coupon's minimum spend",
      );
    }

    const discount = computeCouponDiscount(coupon, params.subtotal);
    const resultsInFree = params.subtotal.minus(discount).lte(0);
    if (resultsInFree && !params.phoneVerifiedAt) {
      throw new ForbiddenException(
        'A 100%-off coupon requires a phone-verified account',
      );
    }

    // CPN-02: pre-check for a clean error; the unique index below is the
    // actual guard under concurrency.
    const already = await tx.couponRedemption.findUnique({
      where: {
        couponId_farmId: { couponId: coupon.id, farmId: params.farmId },
      },
    });
    if (already) {
      throw new ConflictException('This farm has already redeemed this coupon');
    }

    // CPN-01: atomic seat decrement. A conditional update, not a read-then-write
    // — 0 rows affected means exhausted even when concurrent checkouts race
    // this same coupon, so seats can never oversell.
    const flip = await tx.coupon.updateMany({
      where: { id: coupon.id, redeemedCount: { lt: coupon.maxRedemptions } },
      data: { redeemedCount: { increment: 1 } },
    });
    if (flip.count === 0) {
      throw new ConflictException('Coupon exhausted');
    }

    return { couponId: coupon.id, discount };
  }

  /** Records the redemption once the invoice it applied to exists. */
  async recordRedemption(
    tx: Prisma.TransactionClient,
    params: {
      couponId: string;
      farmId: string;
      invoiceId: string;
      discount: Prisma.Decimal;
    },
  ): Promise<void> {
    try {
      await tx.couponRedemption.create({
        data: {
          couponId: params.couponId,
          farmId: params.farmId,
          invoiceId: params.invoiceId,
          discountApplied: params.discount,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This farm has already redeemed this coupon',
        );
      }
      throw err;
    }
  }
}
