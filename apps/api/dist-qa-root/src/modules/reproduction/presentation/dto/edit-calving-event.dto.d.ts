import { CalvingEase } from '@prisma/client';
import { CreateCalfBirthDto } from './create-calving-event.dto';
export declare class EditCalvingEventDto {
    cattleId?: string;
    calvingDate?: string;
    calvingEase?: CalvingEase;
    placentaExpelled?: boolean;
    retainedPlacenta?: boolean;
    complications?: string;
    notes?: string;
    addCalves?: CreateCalfBirthDto[];
    removeCalfBirthIds?: string[];
}
