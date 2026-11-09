import { BreedingMethod, PaymentMethod, SemenSource, SemenType, TargetSex } from '@prisma/client';
export declare class EditBreedingEventDto {
    cattleId?: string;
    breedingDate?: string;
    breedingMethod?: BreedingMethod;
    bullId?: string;
    semenBatchId?: string;
    inseminator?: string;
    semenSource?: SemenSource;
    serviceProviderId?: string;
    sireNameOrCode?: string;
    sireBreed?: string;
    semenType?: SemenType;
    targetSex?: TargetSex;
    strawBatchCode?: string;
    semenCompany?: string;
    serviceCost?: number;
    paymentMethod?: PaymentMethod;
    financialAccountId?: string;
    breedingNumber?: number;
    expectedPregnancyCheckDate?: string;
    notes?: string;
}
