import { HeatDetectionMethod } from '@prisma/client';
import { BooleanSymptomsDto } from './common.dto';
export declare class CreateHeatEventDto extends BooleanSymptomsDto {
    cattleId: string;
    heatDateTime: string;
    detectionMethod: HeatDetectionMethod;
    notes?: string;
}
