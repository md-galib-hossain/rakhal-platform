import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { FarmSettingsService } from './farm-settings.service';

/**
 * Lean provider of {@link FarmSettingsService} (RD-016). Feature modules import this
 * to read per-farm `FarmModuleSettings` tunables. PrismaModule is global; only
 * LoggerModule needs importing.
 */
@Module({
  imports: [LoggerModule],
  providers: [FarmSettingsService],
  exports: [FarmSettingsService],
})
export class FarmSettingsModule {}
