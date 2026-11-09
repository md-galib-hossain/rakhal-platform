"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var CouponService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CouponService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const coupon_pricing_1 = require("../../domain/coupon-pricing");
let CouponService = CouponService_1 = class CouponService {
    prisma;
    log;
    constructor(prisma, logger) {
        this.prisma = prisma;
        this.log = logger.setContext(CouponService_1.name);
    }
    async issue(input) {
        const code = input.code.trim().toUpperCase();
        let coupon;
        try {
            coupon = await this.prisma.coupon.create({
                data: {
                    code,
                    type: input.type,
                    value: new client_1.Prisma.Decimal(input.value),
                    maxRedemptions: input.maxRedemptions,
                    perFarmLimit: input.perFarmLimit ?? 1,
                    validFrom: input.validFrom,
                    validUntil: input.validUntil,
                    applicablePlanIds: input.applicablePlanIds ?? [],
                    minSpend: input.minSpend != null ? new client_1.Prisma.Decimal(input.minSpend) : null,
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException(`Coupon code "${code}" already exists`);
            }
            throw err;
        }
        this.log.info('Coupon issued', { couponId: coupon.id, code });
        return coupon;
    }
    list(status) {
        return this.prisma.coupon.findMany({
            where: status ? { status } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }
    async disable(id) {
        const coupon = await this.prisma.coupon.findUnique({ where: { id } });
        if (!coupon)
            throw new common_1.NotFoundException('Coupon not found');
        const updated = await this.prisma.coupon.update({
            where: { id },
            data: { status: client_1.CouponStatus.DISABLED },
        });
        this.log.info('Coupon disabled', { couponId: id, code: coupon.code });
        return updated;
    }
    async validateAndPrice(db, params) {
        const code = params.code.trim().toUpperCase();
        const coupon = await db.coupon.findUnique({ where: { code } });
        if (!coupon)
            throw new common_1.NotFoundException('Coupon not found');
        if (coupon.status !== client_1.CouponStatus.ACTIVE) {
            throw new common_1.ForbiddenException('Coupon is disabled');
        }
        const now = new Date();
        if (now < coupon.validFrom || now > coupon.validUntil) {
            throw new common_1.ForbiddenException('Coupon is not valid at this time');
        }
        if (coupon.applicablePlanIds.length > 0 &&
            !coupon.applicablePlanIds.includes(params.planId)) {
            throw new common_1.ForbiddenException('Coupon does not apply to this plan');
        }
        if (coupon.minSpend && params.subtotal.lt(coupon.minSpend)) {
            throw new common_1.ForbiddenException("Order total is below this coupon's minimum spend");
        }
        const discount = (0, coupon_pricing_1.computeCouponDiscount)(coupon, params.subtotal);
        const resultsInFree = params.subtotal.minus(discount).lte(0);
        if (resultsInFree && !params.phoneVerifiedAt) {
            throw new common_1.ForbiddenException('A 100%-off coupon requires a phone-verified account');
        }
        return { coupon, discount };
    }
    async preview(params) {
        const { coupon, discount } = await this.validateAndPrice(this.prisma, params);
        return { couponId: coupon.id, discount };
    }
    async reserve(tx, params) {
        const { coupon, discount } = await this.validateAndPrice(tx, params);
        const already = await tx.couponRedemption.findUnique({
            where: {
                couponId_farmId: { couponId: coupon.id, farmId: params.farmId },
            },
        });
        if (already) {
            throw new common_1.ConflictException('This farm has already redeemed this coupon');
        }
        const flip = await tx.coupon.updateMany({
            where: { id: coupon.id, redeemedCount: { lt: coupon.maxRedemptions } },
            data: { redeemedCount: { increment: 1 } },
        });
        if (flip.count === 0) {
            throw new common_1.ConflictException('Coupon exhausted');
        }
        return { couponId: coupon.id, discount };
    }
    async recordRedemption(tx, params) {
        try {
            await tx.couponRedemption.create({
                data: {
                    couponId: params.couponId,
                    farmId: params.farmId,
                    invoiceId: params.invoiceId,
                    discountApplied: params.discount,
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                throw new common_1.ConflictException('This farm has already redeemed this coupon');
            }
            throw err;
        }
    }
};
exports.CouponService = CouponService;
exports.CouponService = CouponService = CouponService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        logger_service_1.LoggerService])
], CouponService);
//# sourceMappingURL=coupon.service.js.map