import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { CursorPage } from 'src/common/pagination';
import { ListAdminFarmsQueryDto, ListAdminUsersQueryDto } from '../../presentation/dto/admin-directory.dto';
export interface DayCount {
    day: string;
    count: number;
}
export declare class AdminDirectoryService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    listFarms(query: ListAdminFarmsQueryDto): Promise<{
        items: {
            memberCount: number;
            cattleCount: number;
            subscription: {
                subscriptionPlan: {
                    name: string;
                    id: string;
                };
                expiresAt: Date | null;
                status: import("@prisma/client").$Enums.SubscriptionStatus;
                startsAt: Date;
                cancelledAt: Date | null;
                pendingPlan: {
                    name: string;
                    id: string;
                } | null;
            };
            name: string;
            id: string;
            createdAt: Date;
            status: import("@prisma/client").$Enums.FarmStatus;
            division: string | null;
            district: string | null;
            farmCode: string | null;
            owner: {
                email: string;
                name: string;
                id: string;
            };
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    getFarm(id: string): Promise<{
        cattleRecords: number;
        lastActivityAt: Date | null;
        subscription: {
            subscriptionPlan: {
                name: string;
                id: string;
            };
            expiresAt: Date | null;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            startsAt: Date;
            cancelledAt: Date | null;
            pendingPlan: {
                name: string;
                id: string;
            } | null;
        };
        subscriptionHistory: {
            subscriptionPlan: {
                name: string;
                id: string;
            };
            expiresAt: Date | null;
            status: import("@prisma/client").$Enums.SubscriptionStatus;
            startsAt: Date;
            cancelledAt: Date | null;
            pendingPlan: {
                name: string;
                id: string;
            } | null;
        }[];
        members: {
            email: string;
            name: string;
            id: string;
            isBlocked: boolean;
            lastLoginAt: Date | null;
            joinedAt: Date;
            role: string;
        }[];
        name: string;
        id: string;
        createdAt: Date;
        description: string | null;
        slug: string;
        status: import("@prisma/client").$Enums.FarmStatus;
        division: string | null;
        district: string | null;
        upazila: string | null;
        operationalPurpose: string | null;
        phone: string | null;
        address: string | null;
        herdSizeBand: string | null;
        farmCode: string | null;
        hasCompletedOnboarding: boolean;
        timezone: string;
        owner: {
            email: string;
            name: string;
            id: string;
            isEmailVerified: boolean;
            isBlocked: boolean;
            lastLoginAt: Date | null;
        };
    }>;
    listUsers(query: ListAdminUsersQueryDto): Promise<{
        items: {
            farmCount: number;
            ownedFarmCount: number;
            lastActiveAt: Date | null;
            email: string;
            name: string;
            id: string;
            createdAt: Date;
            isEmailVerified: boolean;
            isBlocked: boolean;
            lockedUntil: Date | null;
            lastLoginAt: Date | null;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    getUser(id: string): Promise<{
        recentSessions: {
            id: string;
            createdAt: Date;
            expiresAt: Date;
            status: import("@prisma/client").$Enums.SessionStatus;
            ipAddress: string | null;
            userAgent: string | null;
            deviceName: string | null;
            lastUsedAt: Date | null;
        }[];
        connectedChannels: {
            id: string;
            provider: string;
            platform: string;
            createdAt: Date;
            lastSeenAt: Date;
        }[];
        hasTelegram: boolean;
        hasPush: boolean;
        mfaConfigured: boolean;
        ownedFarmCount: number;
        activeSessionCount: number;
        memberships: {
            joinedAt: Date;
            role: string;
            farm: {
                name: string;
                id: string;
                status: import("@prisma/client").$Enums.FarmStatus;
            };
        }[];
        email: string;
        name: string;
        id: string;
        createdAt: Date;
        isEmailVerified: boolean;
        emailVerifiedAt: Date | null;
        isBlocked: boolean;
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        lastPasswordChangedAt: Date | null;
        preferredLanguage: import("@prisma/client").$Enums.Language;
    }>;
    overview(): Promise<{
        generatedAt: string;
        farms: {
            total: number;
            byStatus: Record<string, number>;
            newLast7Days: number;
            newLast30Days: number;
            newThisMonth: number;
        };
        users: {
            total: number;
            blocked: number;
            newLast7Days: number;
            newLast30Days: number;
            newThisMonth: number;
            activeLastDay: number;
            activeLast30Days: number;
        };
        subscriptions: {
            byStatus: {
                [k: string]: number;
            };
        };
        signups: {
            days: number;
            farms: DayCount[];
            users: DayCount[];
        };
    }>;
    private activeUsers;
    private dailySeries;
    private fillDays;
}
export type AdminPage<T> = CursorPage<T>;
