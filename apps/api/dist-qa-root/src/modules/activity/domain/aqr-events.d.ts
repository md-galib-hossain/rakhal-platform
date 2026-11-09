import { ActivityLogModule } from '@prisma/client';
export interface AqrEventDef {
    delta: number;
    nullify?: boolean;
    module: ActivityLogModule;
    title: string;
}
export interface AqrBounds {
    min: number;
    max: number;
}
export declare const AQR_DEFAULT_BOUNDS: AqrBounds;
export declare const AQR_EVENTS: {
    animal_registered: {
        delta: number;
        module: "COW_MANAGEMENT";
        title: string;
    };
    milk_session_logged: {
        delta: number;
        module: "MILK_PRODUCTION";
        title: string;
    };
    sickness_reported: {
        delta: number;
        module: "HEALTH_SAFETY";
        title: string;
    };
    preventive_care_logged: {
        delta: number;
        module: "HEALTH_SAFETY";
        title: string;
    };
    recovered: {
        delta: number;
        module: "HEALTH_SAFETY";
        title: string;
    };
    mortality: {
        delta: number;
        nullify: true;
        module: "HEALTH_SAFETY";
        title: string;
    };
    calving_successful: {
        delta: number;
        module: "BREEDING";
        title: string;
    };
    pregnancy_confirmed: {
        delta: number;
        module: "BREEDING";
        title: string;
    };
    treatment_completed: {
        delta: number;
        module: "HEALTH_SAFETY";
        title: string;
    };
};
export type AqrEventKey = keyof typeof AQR_EVENTS;
