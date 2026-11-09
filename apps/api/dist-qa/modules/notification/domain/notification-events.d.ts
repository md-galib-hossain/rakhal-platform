export type NotificationCategory = 'health_safety' | 'reproduction' | 'operational' | 'financial' | 'inventory';
export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
export type NotificationChannel = 'in_app' | 'push' | 'sms' | 'whatsapp' | 'telegram' | 'email';
export interface NotificationChannels {
    in_app: boolean;
    push: boolean;
    sms: boolean;
    whatsapp: boolean;
    telegram: boolean;
    email: boolean;
}
export interface NotificationEventDef {
    key: string;
    label: string;
    category: NotificationCategory;
    priority: NotificationPriority;
    canDisable: boolean;
    defaultChannels: NotificationChannels;
}
export declare const NOTIFICATION_EVENTS: NotificationEventDef[];
export declare function getEvent(key: string): NotificationEventDef | undefined;
export declare function isKnownEvent(key: string): boolean;
export declare function externalChannels(channels: NotificationChannels): NotificationChannel[];
