import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { LegalConsentService } from './application/services/legal-consent.service';
import { LegalController } from './presentation/controllers/legal.controller';

/**
 * Compliance (RAKHAL-236, PRD §36). Legal consent — versioned ToS/Privacy +
 * per-user acceptance + the `hasAcceptedCurrent` gate the farm-create and
 * checkout flows enforce (LGL-02/03). Dependency-light on purpose (Auth for the
 * controller guards, Prisma is global) so `FarmModule`/`BillingModule` can
 * import it for the gate without a cycle. Admin authoring/publishing UI is
 * RAKHAL-225 (versions are seeded for now).
 */
@Module({
  imports: [LoggerModule, AuthModule],
  controllers: [LegalController],
  providers: [LegalConsentService],
  exports: [LegalConsentService],
})
export class ComplianceModule {}
