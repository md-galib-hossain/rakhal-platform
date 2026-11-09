import { AdminCommunicationsService } from '../../application/services/admin-communications.service';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminBroadcastMessageDto, AdminSendMessageDto } from '../dto/admin-communication.dto';
export declare class AdminCommunicationsController {
    private readonly communications;
    constructor(communications: AdminCommunicationsService);
    getChannelStats(): Promise<{
        totalUsers: number;
        telegramSubscribers: number;
        pushSubscribers: number;
    }>;
    sendMessageToUser(admin: CurrentAdminContext, userId: string, dto: AdminSendMessageDto): Promise<{
        delivered: boolean;
        recipient: {
            id: string;
            name: string;
            email: string;
        };
    }>;
    broadcast(admin: CurrentAdminContext, dto: AdminBroadcastMessageDto): Promise<{
        targetedCount: number;
        deliveredCount: number;
        message: string;
    } | {
        targetedCount: number;
        deliveredCount: number;
        message?: undefined;
    }>;
}
