import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { env } from 'src/core/config/env';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { MediaService } from './application/services/media.service';
import { ImageProcessorService } from './application/services/image-processor.service';
import { OBJECT_STORAGE } from './application/ports/object-storage.port';
import { R2StorageAdapter } from './infrastructure/adapters/r2-storage.adapter';
import { MemoryStorageAdapter } from './infrastructure/adapters/memory-storage.adapter';
import { MediaController } from './presentation/controllers/media.controller';

/**
 * Media / image uploads (RAKHAL-009). Sharp processing + a private Cloudflare R2
 * bucket behind the `OBJECT_STORAGE` seam. The adapter is config-selected:
 * **in `NODE_ENV=test` the in-memory fake is always used** (so the suite never
 * touches the real bucket); in production `STORAGE_PROVIDER=r2` requires the R2
 * creds (fail-closed at boot); dev without creds falls back to memory. Exports
 * `MediaService` so consumer modules (Cattle now) can upload/attach images.
 */
@Module({
  imports: [LoggerModule, AuthModule, TenantAccessModule, PermissionModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    ImageProcessorService,
    R2StorageAdapter,
    MemoryStorageAdapter,
    {
      provide: OBJECT_STORAGE,
      useFactory: (r2: R2StorageAdapter, memory: MemoryStorageAdapter) => {
        if (env.NODE_ENV === 'test') return memory;
        if (env.STORAGE_PROVIDER === 'r2') {
          if (!r2.isConfigured()) {
            throw new Error(
              'STORAGE_PROVIDER=r2 but R2_* credentials are missing',
            );
          }
          return r2;
        }
        return memory;
      },
      inject: [R2StorageAdapter, MemoryStorageAdapter],
    },
  ],
  exports: [MediaService, OBJECT_STORAGE],
})
export class MediaModule {}
