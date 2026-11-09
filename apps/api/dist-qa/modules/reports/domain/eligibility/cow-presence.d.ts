export interface PresencePeriod {
    start: Date;
    end: Date;
    startDate?: string;
    endDate?: string;
}
export interface CowPresenceInput {
    enteredAt?: Date | null;
    createdAt: Date;
    dispositionDate?: Date | null;
    deletedAt?: Date | null;
}
export type EntrySource = 'enteredAt' | 'createdAt';
export type AbsentReason = 'deleted' | 'entered_after_period' | 'exited_before_period';
export interface PresenceResult {
    present: boolean;
    entrySource: EntrySource;
    reason: AbsentReason | null;
}
export declare function evaluatePresence(cow: CowPresenceInput, period: PresencePeriod, generatedAt?: Date): PresenceResult;
export declare function isPresentDuring(cow: CowPresenceInput, period: PresencePeriod, generatedAt?: Date): boolean;
