export declare class AdminSendMessageDto {
    title: string;
    message: string;
    link?: string;
    channel?: 'all' | 'telegram' | 'push';
}
export declare class AdminBroadcastMessageDto extends AdminSendMessageDto {
    targetAudience?: 'all' | 'owners' | 'pro_plan' | 'with_telegram';
    targetUserIds?: string[];
}
