declare module 'prom-client' {
  export class Registry {
    contentType: string;
    metrics(): Promise<string>;
  }

  export type LabelValues<T extends string> = Record<T, string>;

  export class Counter<T extends string = string> {
    constructor(config: {
      name: string;
      help: string;
      labelNames?: readonly T[];
      registers?: Registry[];
    });
    inc(labels?: LabelValues<T>, value?: number): void;
  }

  export class Histogram<T extends string = string> {
    constructor(config: {
      name: string;
      help: string;
      labelNames?: readonly T[];
      buckets?: number[];
      registers?: Registry[];
    });
    observe(labels: LabelValues<T>, value: number): void;
    observe(value: number): void;
  }

  export class Gauge<T extends string = string> {
    constructor(config: {
      name: string;
      help: string;
      labelNames?: readonly T[];
      registers?: Registry[];
    });
    set(value: number): void;
    set(labels: LabelValues<T>, value: number): void;
  }

  export function collectDefaultMetrics(config?: {
    register?: Registry;
    prefix?: string;
  }): void;
}

declare module '@sentry/node' {
  export interface Scope {
    setExtra(key: string, extra: unknown): void;
  }

  export function init(options: {
    dsn?: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
  }): void;

  export function withScope(callback: (scope: Scope) => void): void;
  export function captureException(exception: unknown): string;
}
