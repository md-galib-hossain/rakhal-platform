import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Coupon, CouponStatus, CouponType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
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
 * platform-admin-only actions (CPN-06) — wired to `admin-api` behind
 * `PlatformAdminGuard` by the `AdminBillingController` (RAKHAL-224), which owns
 * the admin audit trail (`AdminAuditService`); these methods stay pure business
 * logic. `reserve`/`recordRedemption` are called from inside
 * `BillingService.checkout`'s own transaction so the seat decrement, the
 * per-farm-once check, and the invoice commit atomically (CPN-01).
 */
@Injectable()
export class CouponService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(CouponService.name);
  }

  async issue(input: IssueCouponInput): Promise<Coupon> {
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

    this.log.info('Coupon issued', { couponId: coupon.id, code });
    return coupon;
  }

  list(status?: CouponStatus): Promise<Coupon[]> {
    return this.prisma.coupon.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async disable(id: string): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { status: CouponStatus.DISABLED },
    });
    this.log.info('Coupon disabled', { couponId: id, code: coupon.code });
    return updated;
  }

  /**
   * Pure rule check + pricing (existence/status/window/plan-applicability/
   * min-spend/discount math/100%-off-needs-verified-phone) — shared by
   * `reserve` (which adds the mutating per-farm-redemption check + atomic seat
   * decrement) and `preview` (which mutates nothing). Accepts either the
   * plain `PrismaService` (preview, outside any transaction) or a
   * `Prisma.TransactionClient` (reserve, inside the checkout transaction).
   */
  private async validateAndPrice(
    db: PrismaService | Prisma.TransactionClient,
    params: {
      code: string;
      planId: string;
      subtotal: Prisma.Decimal;
      phoneVerifiedAt: Date | null;
    },
  ): Promise<{ coupon: Coupon; discount: Prisma.Decimal }> {
    const code = params.code.trim().toUpperCase();
    const coupon = await db.coupon.findUnique({ where: { code } });
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

    return { coupon, discount };
  }

  /**
   * Non-mutating preview for the upgrade modal's coupon stage. Runs the
   * identical rule set as `reserve` but performs neither the seat decrement
   * nor the per-farm-redemption check — a coupon this farm already redeemed
   * still previews fine (so the UI can show the price); `checkout`/`reserve`
   * remains the real, atomic gate.
   */
  async preview(params: {
    code: string;
    farmId: string;
    planId: string;
    subtotal: Prisma.Decimal;
    phoneVerifiedAt: Date | null;
  }): Promise<CouponReservation> {
    const { coupon, discount } = await this.validateAndPrice(
      this.prisma,
      params,
    );
    return { couponId: coupon.id, discount };
  }

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
    const { coupon, discount } = await this.validateAndPrice(tx, params);

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
