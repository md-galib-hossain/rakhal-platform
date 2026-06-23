import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { FarmService } from './application/services/farm.service';
import { FarmController } from './presentation/controllers/farm.controller';

/**
 * Farm bootstrap module (RAKHAL-021, partial): create a farm + owner membership
 * so the RBAC/tenant chain has something to resolve. Imports AuthModule for the
 * JwtAuthGuard / SessionGuard used by the controller.
 */
@Module({
  imports: [AuthModule, LoggerModule],
  controllers: [FarmController],
  providers: [FarmService],
  exports: [FarmService],
})
export class FarmModule {}
