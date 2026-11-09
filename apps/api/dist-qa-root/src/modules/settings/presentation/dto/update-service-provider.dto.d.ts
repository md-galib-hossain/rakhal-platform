import { ServiceProviderType } from '@prisma/client';
export declare class UpdateServiceProviderDto {
    name?: string;
    phone?: string;
    type?: ServiceProviderType;
    deleted_at?: string | null;
}
