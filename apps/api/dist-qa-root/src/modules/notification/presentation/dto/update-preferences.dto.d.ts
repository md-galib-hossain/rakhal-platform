export declare class QuietHoursDto {
    start: string;
    end: string;
}
export declare class PreferenceChannelsDto {
    in_app: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    telegram: boolean;
    email: boolean;
}
export declare class PreferenceItemDto {
    event_key: string;
    enabled?: boolean;
    channels?: PreferenceChannelsDto;
}
export declare class UpdatePreferencesDto {
    quiet_hours?: QuietHoursDto;
    preferences?: PreferenceItemDto[];
}
