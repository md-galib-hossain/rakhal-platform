import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

export interface LoggerContextData {
  requestId: string;
  traceId?: string;
  userId?: string;
  tenantId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

@Injectable()
export class LoggerContext {
  private readonly storage = new AsyncLocalStorage<LoggerContextData>();

  run<T>(context: LoggerContextData, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  get(): LoggerContextData | undefined {
    return this.storage.getStore();
  }

  set<K extends keyof LoggerContextData>(
    key: K,
    value: LoggerContextData[K],
  ): void {
    const store = this.storage.getStore();
    if (store) store[key] = value;
  }

  get requestId(): string | undefined {
    return this.get()?.requestId;
  }

  get userId(): string | undefined {
    return this.get()?.userId;
  }
}
