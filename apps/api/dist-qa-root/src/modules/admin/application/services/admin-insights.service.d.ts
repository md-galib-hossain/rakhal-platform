import { PrismaService } from 'src/core/database/prisma/prisma.service';
export interface DayCount {
    day: string;
    count: number;
}
export declare class AdminInsightsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    engagement(): Promise<{
        generatedAt: string;
        users: {
            total: number;
            active: {
                daily: number;
                weekly: number;
                monthly: number;
            };
            stickiness: number | null;
            returning: number;
            dormant: number;
        };
        activation: {
            windowDays: number;
            signedUp: number;
            activated: number;
            rate: number | null;
            neverActivated: number;
            medianHoursToFirstRecord: number | null;
        };
        retention: {
            d7: {
                base: number;
                kept: number;
                rate: number | null;
            };
            d30: {
                base: number;
                kept: number;
                rate: number | null;
            };
        };
        farms: {
            total: number;
            withRecordsLast30Days: number;
            everRecorded: number;
            shareWithRecordsLast30Days: number | null;
        };
        records: {
            cattleTracked: number;
            last30Days: number;
        };
        modules: {
            module: string;
            farms: number;
            records: number;
            shareOfActiveFarms: number | null;
        }[];
        dailyActiveUsers: DayCount[];
        geography: {
            unspecifiedFarms: number;
            divisions: {
                farms: number;
                cattle: number;
                name: string;
            }[];
            districts: {
                division: string | null;
                district: string;
                farms: number;
            }[];
        };
    }>;
    private activeUsers;
    private retained;
    private fillDays;
    private geography;
    security(): Promise<{
        generatedAt: string;
        counts: {
            activeSessions: number;
            signIns24h: number;
            signIns7d: number;
            usersWithFailedAttempts24h: number;
            lockedNow: number;
            blocked: number;
            adminFailedLogins24h: number;
        };
        recentSignIns: {
            user: {
                email: string;
                name: string;
                id: string;
            };
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.SessionStatus;
            ipAddress: string | null;
            userAgent: string | null;
            deviceName: string | null;
            lastUsedAt: Date | null;
        }[];
        needsAttention: {
            email: string;
            name: string;
            id: string;
            isBlocked: boolean;
            failedLoginAttempts: number;
            lastFailedLoginAt: Date | null;
            lockedUntil: Date | null;
        }[];
        multiLocation: {
            id: string;
            name: string;
            email: string;
            distinctIps: number;
        }[];
        adminFailedLogins: {
            id: string;
            createdAt: Date;
            ipAddress: string | null;
            actorEmail: string | null;
        }[];
    }>;
}
