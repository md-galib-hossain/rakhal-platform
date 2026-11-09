import { CalfBirthStatus, CalvingEase, CattleGender } from '@prisma/client';
export declare class CreateCalfBirthDto {
    gender: CattleGender;
    tagNumber?: string;
    name?: string;
    birthWeight?: number;
    status: CalfBirthStatus;
}
export declare class CreateCalvingEventDto {
    cattleId: string;
    pregnancyId?: string;
    calvingDate: string;
    calvingNumber?: number;
    calvingEase: CalvingEase;
    calfCount?: number;
    placentaExpelled?: boolean;
    retainedPlacenta?: boolean;
    complications?: string;
    notes?: string;
    calves?: CreateCalfBirthDto[];
}
