import { FollowUpService } from '../../application/services/follow-up.service';
declare class FollowUpRuleSettingDto {
    ruleKey: string;
    enabled?: boolean;
    offsetDays?: number | null;
}
export declare class UpdateFollowUpRulesDto {
    rules: FollowUpRuleSettingDto[];
}
export declare class FollowUpRulesController {
    private readonly followUps;
    constructor(followUps: FollowUpService);
    list(farmId: string): Promise<{
        ruleKey: import("../../domain/follow-up-rules").FollowUpRuleKey;
        title: string;
        kind: "TASK" | "SUGGESTION";
        trigger: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        enabled: boolean;
        defaultOn: boolean;
        offsetDays: number | null;
        defaultOffsetDays: number | null;
        completesOn: ("MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM")[];
    }[]>;
    update(farmId: string, dto: UpdateFollowUpRulesDto): Promise<{
        ruleKey: import("../../domain/follow-up-rules").FollowUpRuleKey;
        title: string;
        kind: "TASK" | "SUGGESTION";
        trigger: "MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM";
        enabled: boolean;
        defaultOn: boolean;
        offsetDays: number | null;
        defaultOffsetDays: number | null;
        completesOn: ("MOVE" | "SOLD" | "CULLED" | "BREEDING" | "HEAT" | "PREG_CHECK" | "CALVING" | "ABORTION" | "DRY_OFF" | "ILLNESS" | "TREATMENT" | "VACCINATION" | "DEWORMING" | "WEIGHT" | "BCS" | "WEANING" | "CASTRATION" | "ENTER_FATTENING" | "LEAVE_FATTENING" | "DIED" | "NOTE" | "HOOF_TRIM" | "DEHORN" | "CUSTOM")[];
    }[]>;
}
export {};
