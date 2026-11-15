import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';
import type { Response } from 'express';
import type { IdempotentOutcome } from './application/idempotency.service';

/** Request header carrying the client-generated key (ADR-006). Header names are case-insensitive. */
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
/** Response header set to `true` when the stored response of an earlier identical request was returned. */
export const IDEMPOTENCY_REPLAYED_HEADER = 'Idempotency-Replayed';

/** Documents the optional `Idempotency-Key` header in OpenAPI so generated clients expose it. */
export const ApiIdempotencyKey = () =>
  applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      required: false,
      description:
        'Client-generated key (8-128 chars) for a write that may be retried, e.g. one queued offline. A repeat with the same key and body returns the first response (header `Idempotency-Replayed: true`); the same key with a different body is 422.',
    }),
  );

/** Unwrap an idempotent run for the controller: flag a replay on the response, return the body. */
export function unwrapIdempotent<T>(
  res: Response,
  outcome: IdempotentOutcome<T>,
): T {
  if (outcome.replayed) res.setHeader(IDEMPOTENCY_REPLAYED_HEADER, 'true');
  return outcome.result;
}
