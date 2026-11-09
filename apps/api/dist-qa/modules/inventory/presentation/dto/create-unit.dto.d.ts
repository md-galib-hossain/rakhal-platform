import { UnitDimension } from '@prisma/client';
export declare class CreateUnitDto {
    name: string;
    symbol: string;
    dimension: UnitDimension;
    conversionToBase?: number;
}
