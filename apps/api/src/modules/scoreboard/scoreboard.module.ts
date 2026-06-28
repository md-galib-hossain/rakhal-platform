import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { ScoreboardService } from './application/services/scoreboard.service';
import { ScoreboardController } from './presentation/controllers/scoreboard.controller';

/**
 * Scoreboard / national leaderboard (PRD §18 / API §14, V1.5). Reads Cattle/AQR +
 * Farm directly via Prisma (the aggregator pattern — no cross-module coupling).
 */
@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule, PermissionModule],
  controllers: [ScoreboardController],
  providers: [ScoreboardService],
})
export class ScoreboardModule {}
