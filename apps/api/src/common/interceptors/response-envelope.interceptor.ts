import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standard success envelope mandated by the Rakhaal API contract:
 *   { success: true, data, meta? }
 *
 * The matching error envelope is produced by GlobalExceptionFilter, so this
 * interceptor only handles the success path.
 *
 * Pass-through rules (no wrapping) to avoid double-enveloping or corrupting
 * non-JSON responses:
 *  - `undefined`/`null` payloads (e.g. `@Res()` responses, 204 No Content)
 *  - values that already look like an envelope (own boolean `success` field)
 *  - Buffers / streams (binary downloads such as PDFs or `/metrics`)
 *
 * Pagination support: services that return `{ items, meta }` are hoisted to
 * `{ success: true, data: items, meta }`. A bare `{ data, meta }` is preserved
 * with `success: true` added.
 */
export interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  meta?: unknown;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((payload) => this.toEnvelope(payload)));
  }

  private toEnvelope(payload: unknown): unknown {
    if (payload === undefined || payload === null) {
      return payload;
    }

    if (this.isAlreadyEnveloped(payload) || this.isBinary(payload)) {
      return payload;
    }

    if (this.isPaginated(payload)) {
      return {
        success: true,
        data: payload.items,
        meta: payload.meta,
      } satisfies SuccessEnvelope;
    }

    if (this.hasDataAndMeta(payload)) {
      return {
        success: true,
        data: payload.data,
        meta: payload.meta,
      } satisfies SuccessEnvelope;
    }

    return { success: true, data: payload } satisfies SuccessEnvelope;
  }

  private isAlreadyEnveloped(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      typeof value.success === 'boolean'
    );
  }

  private isBinary(value: unknown): boolean {
    return (
      Buffer.isBuffer(value) ||
      (typeof value === 'object' &&
        value !== null &&
        typeof (value as { pipe?: unknown }).pipe === 'function')
    );
  }

  private isPaginated(
    value: unknown,
  ): value is { items: unknown; meta: unknown } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'items' in value &&
      'meta' in value
    );
  }

  private hasDataAndMeta(
    value: unknown,
  ): value is { data: unknown; meta: unknown } {
    return (
      typeof value === 'object' &&
      value !== null &&
      'data' in value &&
      'meta' in value
    );
  }
}
