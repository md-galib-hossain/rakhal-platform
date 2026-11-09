import { ChipEligibility, EventChip, EventGroup, EventTypeDefinition } from './catalogue';
export declare const CUSTOM_GROUPS: EventGroup[];
export interface CustomField {
    key: string;
    label: string;
    kind: 'number' | 'text' | 'select';
    unit?: string;
    options?: string[];
    required?: boolean;
}
export declare const MAX_CUSTOM_FIELDS = 20;
export declare const MAX_PAYLOAD_BYTES = 4096;
export declare function validateFields(fields: unknown): string[];
export declare function normalizeAppliesTo(raw: unknown): Record<EventChip, ChipEligibility> | null;
export declare function validateCustomPayload(fields: CustomField[], payload: Record<string, unknown>): string[];
export interface CustomTypeRow {
    id: string;
    name: string;
    group: string;
    appliesTo: unknown;
    fields: unknown;
    followUpDays: number | null;
}
export declare function toDefinition(row: CustomTypeRow): EventTypeDefinition;
