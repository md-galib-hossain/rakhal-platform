import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { DomainEventBusService } from './domain-event-bus.service';

@Global()
@Module({
  imports: [LoggerModule],
  providers: [DomainEventBusService],
  exports: [DomainEventBusService],
})
export class DomainEventsModule {}
