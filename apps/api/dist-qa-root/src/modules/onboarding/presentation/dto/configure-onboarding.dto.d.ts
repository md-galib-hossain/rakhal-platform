declare class OnboardingShedDto {
    name: string;
    capacity?: number;
    purpose?: string;
}
export declare class ConfigureOnboardingDto {
    sheds?: OnboardingShedDto[];
    active_sessions?: string[];
    milk_unit?: string;
}
export {};
