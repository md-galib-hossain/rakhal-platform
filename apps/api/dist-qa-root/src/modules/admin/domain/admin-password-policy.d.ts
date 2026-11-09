export declare const ADMIN_PASSWORD_MIN_LENGTH = 12;
export declare const ADMIN_PASSWORD_MAX_LENGTH = 128;
export declare function adminPasswordProblems(password: string): string[];
export declare function assertAdminPasswordPolicy(password: string): void;
export declare function generateTemporaryAdminPassword(length?: number): string;
