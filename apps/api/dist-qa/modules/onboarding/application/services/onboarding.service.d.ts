import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { SettingsService } from 'src/modules/settings/application/services/settings.service';
import { WorkspaceSettingsService } from 'src/modules/settings/application/services/workspace-settings.service';
import { SubscriptionAccessService } from 'src/modules/subscription/application/services/subscription-access.service';
import { CattleImportService } from 'src/modules/cattle/application/services/cattle-import.service';
import { ImportConfirmDto } from 'src/modules/cattle/presentation/dto/import-cattle.dto';
import { ConfigureOnboardingDto } from '../../presentation/dto/configure-onboarding.dto';
export declare class OnboardingService {
    private readonly prisma;
    private readonly settings;
    private readonly workspace;
    private readonly subscriptionAccess;
    private readonly cattleImport;
    private readonly log;
    constructor(prisma: PrismaService, settings: SettingsService, workspace: WorkspaceSettingsService, subscriptionAccess: SubscriptionAccessService, cattleImport: CattleImportService, logger: LoggerService);
    status(farmId: string): Promise<{
        has_completed_onboarding: boolean;
        steps: {
            farm: {
                done: boolean;
            };
            configure: {
                done: boolean;
                sheds: number;
            };
            cattle: {
                done: boolean;
                count: number;
            };
            team: {
                done: boolean;
                members: number;
            };
        };
    }>;
    configure(farmId: string, dto: ConfigureOnboardingDto): Promise<{
        sheds_created: number;
        sessions_configured: string[] | null;
    }>;
    complete(farmId: string): Promise<{
        has_completed_onboarding: boolean;
    }>;
    importCattlePreview(farmId: string, file: Express.Multer.File, mapping?: string): Promise<{
        importSessionId: `${string}-${string}-${string}-${string}-${string}`;
        total: number;
        ready: number;
        errors: number;
        rows: {
            row: number;
            name: string | null;
            tag: string | null;
            status: "error" | "ready";
            error: string | undefined;
        }[];
    }>;
    importCattleConfirm(farmId: string, userId: string, dto: ImportConfirmDto): Promise<{
        imported: number;
        skipped: number;
    }>;
    previewInvite(token: string): Promise<{
        farm_name: string;
        role: string;
        invited_by: string;
        status: string;
        expires_at: Date;
    }>;
    acceptInvite(userId: string, token: string): Promise<{
        farm_id: string;
        farm_name: string;
        role: string;
    }>;
    private mapPurpose;
}
