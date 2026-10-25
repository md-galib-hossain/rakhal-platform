import { Prisma } from '@prisma/client';
import { ReportError } from '../../domain/report-error';
import { SAFE_ERROR_MESSAGE } from './report-pipeline.constants';

export type PipelinePhase = 'compute' | 'render' | 'storage' | 'persist';

/**
 * Maps anything thrown by a pipeline phase to a categorised `ReportError` with a fixed, safe message
 * (raw text, SQL and ids never reach `Report.errorMessage`).
 *
 * - `ReportError`: passes through unchanged.
 * - Prisma request/connection errors (timeouts P2028, serialization P2034, connection P10xx, init
 *   errors): `DB_TIMEOUT`, transient.
 * - Storage phase: `STORAGE_UNAVAILABLE`, transient.
 * - Render phase: `RENDER_FAILED`, permanent.
 * - Anything else unexpected in compute/persist (a deterministic bug, a Prisma validation error):
 *   `GENERATION_FAILED`, permanent. Render-phase surprises stay `RENDER_FAILED`.
 */
export function toReportError(err: unknown, phase: PipelinePhase): ReportError {
  if (err instanceof ReportError) return err;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    err instanceof Prisma.PrismaClientUnknownRequestError
  ) {
    return new ReportError('DB_TIMEOUT', SAFE_ERROR_MESSAGE.DB_TIMEOUT);
  }
  if (phase === 'storage') {
    return new ReportError(
      'STORAGE_UNAVAILABLE',
      SAFE_ERROR_MESSAGE.STORAGE_UNAVAILABLE,
    );
  }
  if (phase === 'render') {
    return new ReportError('RENDER_FAILED', SAFE_ERROR_MESSAGE.RENDER_FAILED);
  }
  return new ReportError(
    'GENERATION_FAILED',
    SAFE_ERROR_MESSAGE.GENERATION_FAILED,
  );
}
