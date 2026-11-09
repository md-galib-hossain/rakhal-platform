export declare class CreateRoleDto {
    name: string;
    description?: string;
    base_role?: 'owner' | 'manager' | 'worker';
    permission_keys?: string[];
}
