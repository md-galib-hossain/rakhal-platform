import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/database/prisma/prisma.module';
import { FarmClockService } from './farm-clock.service';

/** `@Global()` like `PrismaModule`/`OutboxModule`: "what day is it on this farm" is cross-cutting. */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [FarmClockService],
  exports: [FarmClockService],
})
export class FarmTimeModule {}
