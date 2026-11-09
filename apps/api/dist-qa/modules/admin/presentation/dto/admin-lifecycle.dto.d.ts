import { PlatformAdminRole } from '@prisma/client';
export declare class CreateAdminDto {
    email: string;
    name: string;
    role: PlatformAdminRole;
}
export declare class UpdateAdminDto {
    name?: string;
    role?: PlatformAdminRole;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
