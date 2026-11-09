export declare const authConfig: (() => {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    password: {
        argon2MemoryCost: number;
        argon2TimeCost: number;
        argon2Parallelism: number;
    };
    refreshCookie: {
        name: string;
        domain: string | undefined;
        path: string;
        sameSite: "strict" | "lax" | "none";
        secure: boolean;
        httpOnly: boolean;
    };
    csrf: {
        cookieName: string;
        headerName: string;
        secret: string | undefined;
        cookiePath: string;
        cookieSameSite: "strict" | "lax" | "none";
        cookieSecure: boolean;
    };
    rateLimit: {
        ttlSeconds: number;
        maxRequests: number;
        globalMaxRequests: number;
    };
    lockout: {
        maxFailedAttempts: number;
        windowSeconds: number;
        durationSeconds: number;
    };
}) & import("@nestjs/config").ConfigFactoryKeyHost<{
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    password: {
        argon2MemoryCost: number;
        argon2TimeCost: number;
        argon2Parallelism: number;
    };
    refreshCookie: {
        name: string;
        domain: string | undefined;
        path: string;
        sameSite: "strict" | "lax" | "none";
        secure: boolean;
        httpOnly: boolean;
    };
    csrf: {
        cookieName: string;
        headerName: string;
        secret: string | undefined;
        cookiePath: string;
        cookieSameSite: "strict" | "lax" | "none";
        cookieSecure: boolean;
    };
    rateLimit: {
        ttlSeconds: number;
        maxRequests: number;
        globalMaxRequests: number;
    };
    lockout: {
        maxFailedAttempts: number;
        windowSeconds: number;
        durationSeconds: number;
    };
}>;
