import { PaymentService } from '../../application/payment.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { AllocatePaymentDto } from '../dto/allocate-payment.dto';
export declare class PaymentController {
    private readonly payments;
    constructor(payments: PaymentService);
    record(farmId: string, userId: string, dto: CreatePaymentDto): Promise<{
        farmId: string;
        method: import("@prisma/client").$Enums.PaymentMethod;
        id: string;
        createdAt: Date;
        amount: import("@prisma/client/runtime/client").Decimal;
        notes: string | null;
        transactionDate: Date;
        createdById: string;
        financialAccountId: string;
        direction: import("@prisma/client").$Enums.PaymentDirection;
        referenceNumber: string | null;
    }>;
    findAll(farmId: string): Promise<{
        farmId: string;
        method: import("@prisma/client").$Enums.PaymentMethod;
        id: string;
        createdAt: Date;
        amount: import("@prisma/client/runtime/client").Decimal;
        notes: string | null;
        transactionDate: Date;
        createdById: string;
        financialAccountId: string;
        direction: import("@prisma/client").$Enums.PaymentDirection;
        referenceNumber: string | null;
    }[]>;
    findOne(farmId: string, id: string): Promise<import("../../application/payment.service").FinancePaymentWithAllocations>;
    allocate(farmId: string, id: string, dto: AllocatePaymentDto): Promise<{
        id: string;
        createdAt: Date;
        amount: import("@prisma/client/runtime/client").Decimal;
        receivableId: string | null;
        payableId: string | null;
        paymentId: string;
    }[]>;
}
