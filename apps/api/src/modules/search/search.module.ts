import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { SearchService } from './application/services/search.service';
import { SearchController } from './presentation/controllers/search.controller';

/**
 * Global search (RAKHAL-257). Cross-entity fuzzy search over the farm's cattle,
 * tasks, suppliers, buyers, sheds, and medicines via Postgres `pg_trgm`.
 */
@Module({
  imports: [LoggerModule, AuthModule, TenantAccessModule, PermissionModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
