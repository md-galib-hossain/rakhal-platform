import { LegalDocumentType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export interface PublicLegalDocument {
    id: string;
    type: LegalDocumentType;
    version: string;
    title: string;
    content: string;
    url: string | null;
    effective_at: string;
}
export interface ConsentStatus {
    documents: {
        id: string;
        type: LegalDocumentType;
        version: string;
        title: string;
        accepted: boolean;
    }[];
    all_accepted: boolean;
}
export declare class LegalConsentService {
    private readonly prisma;
    private readonly log;
    private readonly TYPES;
    constructor(prisma: PrismaService, logger: LoggerService);
    private currentDoc;
    private currentDocuments;
    getCurrentDocuments(): Promise<PublicLegalDocument[]>;
    getConsentStatus(userId: string): Promise<ConsentStatus>;
    hasAcceptedCurrent(userId: string): Promise<boolean>;
    assertConsent(userId: string): Promise<void>;
    recordConsent(userId: string, documentIds: string[], ipAddress?: string, farmId?: string): Promise<ConsentStatus>;
    private present;
}
