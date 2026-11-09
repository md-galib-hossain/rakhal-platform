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
var PaySupplierUseCase_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaySupplierUseCase = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("src/core/database/prisma/prisma.service");
const logger_service_1 = require("src/core/logger/logger/logger.service");
const money_1 = require("src/common/money");
const payment_service_1 = require("src/modules/finance-v2/payments/application/payment.service");
const activity_log_service_1 = require("src/modules/activity/application/services/activity-log.service");
const payable_service_1 = require("../../payable.service");
let PaySupplierUseCase = PaySupplierUseCase_1 = class PaySupplierUseCase {
    prisma;
    paymentService;
    payableService;
    activityLog;
    log;
    constructor(prisma, paymentService, payableService, activityLog, logger) {
        this.prisma = prisma;
        this.paymentService = paymentService;
        this.payableService = payableService;
        this.activityLog = activityLog;
        this.log = logger.setContext(PaySupplierUseCase_1.name);
    }
    async execute(farmId, userId, dto) {
        if (!(0, money_1.gt)(dto.amount, 0)) {
            throw new common_1.BadRequestException('amount must be greater than zero');
        }
        await this.payableService.findOne(farmId, dto.payableId);
        const result = await this.prisma.$transaction(async (tx) => {
            const payment = await this.paymentService.recordPayment(farmId, userId, {
                direction: client_1.PaymentDirection.OUTGOING,
                financialAccountId: dto.financialAccountId,
                amount: dto.amount,
                method: dto.method,
                transactionDate: dto.transactionDate,
                referenceNumber: dto.referenceNumber,
            }, tx);
            await this.paymentService.allocatePayment(farmId, payment.id, [{ payableId: dto.payableId, amount: dto.amount }], tx);
            const payableRow = await tx.payable.findFirstOrThrow({
                where: { id: dto.payableId, farmId },
            });
            const outstanding = await this.payableService.getOutstanding(farmId, dto.payableId, tx);
            const status = await this.payableService.getStatus(farmId, dto.payableId, tx);
            const payable = {
                ...payableRow,
                outstanding: outstanding.toString(),
                status,
            };
            this.log.info('Supplier payment recorded', {
                farmId,
                payableId: dto.payableId,
                paymentId: payment.id,
                amount: dto.amount,
                payableStatus: payable.status,
            });
            return { payment, payable };
        });
        await this.activityLog.record({
            farmId,
            module: client_1.ActivityLogModule.FINANCE,
            eventTitle: 'Supplier Payment Recorded',
            actionDetails: `Paid ৳${dto.amount} against payable ${dto.payableId} via ${dto.method}. Status now ${result.payable.status}.`,
            actorId: userId,
            financialImpact: -Number(dto.amount),
        });
        return result;
    }
};
exports.PaySupplierUseCase = PaySupplierUseCase;
exports.PaySupplierUseCase = PaySupplierUseCase = PaySupplierUseCase_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        payment_service_1.PaymentService,
        payable_service_1.PayableService,
        activity_log_service_1.ActivityLogService,
        logger_service_1.LoggerService])
], PaySupplierUseCase);
//# sourceMappingURL=pay-supplier.use-case.js.map