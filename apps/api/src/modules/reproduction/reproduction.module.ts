import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { ReproductionService } from './application/services/reproduction.service';
import { CattleReproductionController } from './presentation/controllers/cattle-reproduction.controller';
import { ReproductionController } from './presentation/controllers/reproduction.controller';

@Module({
  imports: [AuthModule, LoggerModule, TenantAccessModule],
  controllers: [ReproductionController, CattleReproductionController],
  providers: [ReproductionService],
  exports: [ReproductionService],
})
export class ReproductionModule {}
