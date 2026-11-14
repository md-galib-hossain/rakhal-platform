import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuditService } from './application/services/audit.service';

@Module({
  imports: [LoggerModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
