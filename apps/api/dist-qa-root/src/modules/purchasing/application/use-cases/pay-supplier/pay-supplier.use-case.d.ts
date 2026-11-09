import { FinancePayment } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PaymentService } from 'src/modules/finance-v2/payments/application/payment.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { PayableService, PayableWithDerived } from '../../payable.service';
import { PaySupplierInput } from './pay-supplier.input';
export interface PaySupplierResult {
    payment: FinancePayment;
    payable: PayableWithDerived;
}
export declare class PaySupplierUseCase {
    private readonly prisma;
    private readonly paymentService;
    private readonly payableService;
    private readonly activityLog;
    private readonly log;
    constructor(prisma: PrismaService, paymentService: PaymentService, payableService: PayableService, activityLog: ActivityLogService, logger: LoggerService);
    execute(farmId: string, userId: string, dto: PaySupplierInput): Promise<PaySupplierResult>;
}
