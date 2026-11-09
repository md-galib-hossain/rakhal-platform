export declare const ANIMAL_EVENT_TYPES: readonly ["HEAT", "BREEDING", "PREG_CHECK", "CALVING", "ABORTION", "DRY_OFF", "ILLNESS", "TREATMENT", "VACCINATION", "DEWORMING", "WEIGHT", "BCS", "WEANING", "CASTRATION", "ENTER_FATTENING", "LEAVE_FATTENING", "MOVE", "SOLD", "DIED", "CULLED", "NOTE", "HOOF_TRIM", "DEHORN", "CUSTOM"];
export type AnimalEventTypeKey = (typeof ANIMAL_EVENT_TYPES)[number];
export type EventGroup = 'REPRODUCTION' | 'HEALTH' | 'GROWTH' | 'MOVEMENT' | 'OTHER';
export declare const EVENT_CHIPS: readonly ["FEMALE", "MALE", "CALF", "HEIFER", "COW", "PREGNANT", "OPEN", "MILKING", "DRY", "FATTENING"];
export type EventChip = (typeof EVENT_CHIPS)[number];
export type ChipEligibility = 'LISTED' | 'WARN' | 'BLOCK';
export interface EventTypeDefinition {
    type: AnimalEventTypeKey;
    group: EventGroup;
    labelKey: string;
    detailTable: string | null;
    appliesTo: Record<EventChip, ChipEligibility>;
    hardRules: string[];
    permission: string;
    allowsHistorical: boolean;
    followUps: string[];
    requiresChip?: EventChip;
}
export declare const EVENT_CATALOGUE: readonly EventTypeDefinition[];
