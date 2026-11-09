import { ImportConfirmDto, ImportPreviewDto } from 'src/modules/cattle/presentation/dto/import-cattle.dto';
import { OnboardingService } from '../../application/services/onboarding.service';
import { AcceptInviteDto } from '../dto/accept-invite.dto';
import { ConfigureOnboardingDto } from '../dto/configure-onboarding.dto';
export declare class OnboardingController {
    private readonly onboarding;
    constructor(onboarding: OnboardingService);
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
    importCattlePreview(farmId: string, file: Express.Multer.File, dto: ImportPreviewDto): Promise<{
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
    acceptInvite(userId: string, dto: AcceptInviteDto): Promise<{
        farm_id: string;
        farm_name: string;
        role: string;
    }>;
}
