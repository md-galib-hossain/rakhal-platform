import { CattleDispositionType } from '@prisma/client';
export declare class DisposeCattleDto {
    type: CattleDispositionType;
    date: string;
    reason?: string;
    price?: number;
}
