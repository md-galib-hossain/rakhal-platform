import type { RequirementSettingsChanges } from '../../domain/requirement-settings';
export declare class UpdateRequirementSettingsDto {
    changes: RequirementSettingsChanges;
    notes?: string;
}
