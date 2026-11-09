export declare class AdminSupportActionDto {
    reason: string;
    confirm: string;
}
export declare class AdminSendPasswordResetDto extends AdminSupportActionDto {
    revokeSessions?: boolean;
}
