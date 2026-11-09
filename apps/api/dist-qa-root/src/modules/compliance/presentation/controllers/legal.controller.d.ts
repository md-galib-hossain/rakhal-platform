import type { Request } from 'express';
import { LegalConsentService } from '../../application/services/legal-consent.service';
import { RecordConsentDto } from '../dto/record-consent.dto';
export declare class LegalController {
    private readonly legal;
    constructor(legal: LegalConsentService);
    documents(): Promise<import("../../application/services/legal-consent.service").PublicLegalDocument[]>;
    status(userId: string): Promise<import("../../application/services/legal-consent.service").ConsentStatus>;
    accept(userId: string, dto: RecordConsentDto, req: Request): Promise<import("../../application/services/legal-consent.service").ConsentStatus>;
}
