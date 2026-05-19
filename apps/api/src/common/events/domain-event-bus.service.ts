/* eslint-disable @typescript-eslint/no-misused-promises */
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';

@Injectable()
export class DomainEventBusService implements OnModuleDestroy {
  private readonly emitter = new EventEmitter();

  emit<TPayload>(event: string, payload: TPayload): void {
    this.emitter.emit(event, payload);
  }

  on<TPayload>(
    event: string,
    listener: (payload: TPayload) => Promise<void> | void,
  ): void {
    this.emitter.on(event, listener);
  }

  off<TPayload>(
    event: string,
    listener: (payload: TPayload) => Promise<void> | void,
  ): void {
    this.emitter.off(event, listener);
  }

  onModuleDestroy(): void {
    this.emitter.removeAllListeners();
  }
}
