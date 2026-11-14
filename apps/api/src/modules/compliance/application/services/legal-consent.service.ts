import { ForbiddenException, Injectable } from '@nestjs/common';
import { LegalDocument, LegalDocumentType } from '@prisma/client';
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

/**
 * Legal consent (RAKHAL-236, PRD §36.1). Serves the **current** published ToS +
 * Privacy, records immutable per-version acceptance (LGL-02), and answers "has
 * this user accepted everything current?" — the gate the farm-create + checkout
 * flows enforce (a new published version flips `all_accepted` false → forces
 * re-consent, LGL-03). Authoring/publishing UI is the admin panel (RAKHAL-225);
 * versions are seeded for now. If no documents are configured the gate is a
 * no-op (fail-open — nothing to accept).
 */
@Injectable()
export class LegalConsentService {
  private readonly log: LoggerService;
  private readonly TYPES: LegalDocumentType[] = [
    LegalDocumentType.TERMS,
    LegalDocumentType.PRIVACY,
  ];

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(LegalConsentService.name);
  }

  private currentDoc(type: LegalDocumentType): Promise<LegalDocument | null> {
    return this.prisma.legalDocument.findFirst({
      where: { type, published: true, effectiveAt: { lte: new Date() } },
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  private async currentDocuments(): Promise<LegalDocument[]> {
    const docs = await Promise.all(this.TYPES.map((t) => this.currentDoc(t)));
    return docs.filter((d): d is LegalDocument => d !== null);
  }

  async getCurrentDocuments(): Promise<PublicLegalDocument[]> {
    const docs = await this.currentDocuments();
    return docs.map((d) => this.present(d));
  }

  async getConsentStatus(userId: string): Promise<ConsentStatus> {
    const docs = await this.currentDocuments();
    if (docs.length === 0) return { documents: [], all_accepted: true };

    const consents = await this.prisma.consentRecord.findMany({
      where: { userId, documentId: { in: docs.map((d) => d.id) } },
      select: { documentId: true },
    });
    const accepted = new Set(consents.map((c) => c.documentId));

    return {
      documents: docs.map((d) => ({
        id: d.id,
        type: d.type,
        version: d.version,
        title: d.title,
        accepted: accepted.has(d.id),
      })),
      all_accepted: docs.every((d) => accepted.has(d.id)),
    };
  }

  /** True when the user has accepted every current document (LGL-02/03). */
  async hasAcceptedCurrent(userId: string): Promise<boolean> {
    return (await this.getConsentStatus(userId)).all_accepted;
  }

  /** The gate the farm-create + checkout flows call. */
  async assertConsent(userId: string): Promise<void> {
    if (!(await this.hasAcceptedCurrent(userId))) {
      throw new ForbiddenException(
        'You must accept the current Terms of Service and Privacy Policy first',
      );
    }
  }

  /**
   * Record acceptance of the current documents (LGL-02). Only **current,
   * published** documents can be accepted — a stale/unknown id is ignored, so a
   * client can't consent to a superseded version. Idempotent per version.
   */
  async recordConsent(
    userId: string,
    documentIds: string[],
    ipAddress?: string,
    farmId?: string,
  ): Promise<ConsentStatus> {
    const current = await this.currentDocuments();
    const byId = new Map(current.map((d) => [d.id, d]));
    const toAccept =
      documentIds.length > 0
        ? documentIds.filter((id) => byId.has(id))
        : current.map((d) => d.id); // empty ⇒ accept all current

    for (const id of toAccept) {
      const doc = byId.get(id)!;
      await this.prisma.consentRecord.upsert({
        where: { userId_documentId: { userId, documentId: id } },
        create: {
          userId,
          farmId: farmId ?? null,
          documentId: id,
          documentType: doc.type,
          version: doc.version,
          ipAddress: ipAddress ?? null,
        },
        update: {}, // acceptance is immutable — never overwrite the original timestamp
      });
    }
    this.log.info('Legal consent recorded', {
      userId,
      documents: toAccept.length,
    });

    return this.getConsentStatus(userId);
  }

  private present(d: LegalDocument): PublicLegalDocument {
    return {
      id: d.id,
      type: d.type,
      version: d.version,
      title: d.title,
      content: d.content,
      url: d.url,
      effective_at: d.effectiveAt.toISOString(),
    };
  }
}
