import { ServiceProviderType } from '@prisma/client';
export declare class CreateServiceProviderDto {
    name: string;
    phone?: string;
    type: ServiceProviderType;
}
