import type { AnimalEventTypeKey } from './catalogue';
export type FollowUpRuleKey = 'BREEDING_TO_PREG_CHECK' | 'PREG_POSITIVE_TO_DRY_OFF' | 'PREG_POSITIVE_TO_CALVING_WATCH' | 'CALVING_TO_VWP_END' | 'SUSPECTED_TO_RECHECK' | 'VACCINATION_NEXT_DOSE' | 'HEAT_TO_BREED_SUGGESTION';
export interface RuleEvent {
    type: AnimalEventTypeKey;
    eventAt: Date;
    payload: Record<string, unknown>;
    result?: 'PREGNANT' | 'NOT_PREGNANT' | 'SUSPECTED';
    expectedCalvingDate?: Date | null;
}
export interface RuleDefaults {
    pregnancyCheckDays: number;
    vwpDays: number;
    dryPeriodDays: number;
    closeUpDays: number;
}
export interface FollowUpRule {
    key: FollowUpRuleKey;
    title: string;
    kind: 'TASK' | 'SUGGESTION';
    defaultOn: boolean;
    trigger: AnimalEventTypeKey;
    completesOn: AnimalEventTypeKey[];
    defaultOffsetDays(d: RuleDefaults): number | null;
    matches(e: RuleEvent): boolean;
    due(e: RuleEvent, offsetDays: number | null): Date | null;
}
export declare const FOLLOW_UP_RULES: readonly FollowUpRule[];
export declare const ruleByKey: (key: string) => FollowUpRule | undefined;
export interface FollowUpOverride {
    enabled?: boolean;
    offsetDays?: number | null;
}
export interface FollowUpPlanItem {
    ruleKey: FollowUpRuleKey;
    title: string;
    kind: 'TASK' | 'SUGGESTION';
    dueDate: Date;
    defaultOn: boolean;
    pastDue: boolean;
}
export declare function planFollowUps(event: RuleEvent, defaults: RuleDefaults, overrides: Partial<Record<string, FollowUpOverride>>, now: Date): FollowUpPlanItem[];
export declare const rulesCompletedBy: (type: AnimalEventTypeKey) => FollowUpRuleKey[];
