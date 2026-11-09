import type { RequirementSettingsChanges } from 'src/modules/feed/domain/requirement-settings';
export declare class CreateRequirementPresetDto {
    name: string;
    description?: string;
    settings: RequirementSettingsChanges;
    effectiveFrom?: string;
}
export declare class UpdateRequirementPresetDto {
    name?: string;
    description?: string;
    settings?: RequirementSettingsChanges;
}
