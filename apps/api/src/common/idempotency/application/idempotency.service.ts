import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { sha256Hex } from 'src/common/crypto/hash.util';
import { ExceptionCode } from 'src/common/exceptions/exception-codes.enum';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

/** Longer than the 30-day offline sync scope (ADR-006), so a write queued through a long offline period still dedupes. */
export const IDEMPOTENCY_RETENTION_DAYS = 35;
/** A reserved-but-never-finished row (the process died mid-request) is treated as abandoned after this long. */
export const IDEMPOTENCY_STALE_MS = 2 * 60 * 1000;

const KEY_PATTERN = /^[A-Za-z0-9_.:-]{8,128}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IdempotentRun {
  farmId: string;
  userId: string;
  /** Stable route name, e.g. `milk.saveLog`. The same key on two routes never collides. */
  endpoint: string;
  /** Raw `Idempotency-Key` header value; with none, the write simply runs. */
  key: string | undefined;
  /** The validated request body, hashed to tell a replay from a reused key. */
  body: unknown;
}

export interface IdempotentOutcome<T> {
  result: T;
  /** True when the stored response of an earlier identical request was returned instead of running again. */
  replayed: boolean;
}

/** JSON with object keys sorted at every level, so the hash does not depend on property order. */
export function canonicalJson(value: unknown): string {
  const plain: unknown = JSON.parse(JSON.stringify(value ?? null));
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, val]) => [k, sort(val)]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(plain));
}

/**
 * Shared per-route idempotency (WP8a, ADR-006). Reserve `(farmId, key, endpoint)` before the write, store the
 * response afterwards, and answer a repeat with that stored response. Differences from the older per-service
 * copies (`AnimalEventWriteService`, reproduction): the request body is hashed (same key + different body is a
 * 422, never the old response), the sending user is recorded, a request abandoned mid-flight stops blocking
 * after two minutes, and rows expire (`purgeExpired`).
 */
@Injectable()
export class IdempotencyService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(IdempotencyService.name);
  }

  async run<T>(
    input: IdempotentRun,
    fn: () => Promise<T>,
  ): Promise<IdempotentOutcome<T>> {
    const { farmId, userId, endpoint, key } = input;
    if (!key) return { result: await fn(), replayed: false };
    this.assertKey(key);
    const requestHash = sha256Hex(canonicalJson(input.body));
    const where = { farmId_key_endpoint: { farmId, key, endpoint } };

    for (let attempt = 0; ; attempt += 1) {
      try {
        await this.prisma.idempotencyKey.create({
          data: { farmId, key, endpoint, userId, requestHash },
        });
        break;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const existing = await this.prisma.idempotencyKey.findUnique({
          where,
        });
        // Deleted between the failed insert and the read (a failed first request): reserve again.
        if (!existing) {
          if (attempt < 3) continue;
          throw this.inProgress();
        }
        if (existing.requestHash && existing.requestHash !== requestHash) {
          throw this.reused();
        }
        if (existing.responseBody !== null) {
          return { result: existing.responseBody as T, replayed: true };
        }
        const abandoned =
          Date.now() - existing.createdAt.getTime() > IDEMPOTENCY_STALE_MS;
        if (abandoned && attempt === 0) {
          await this.prisma.idempotencyKey.deleteMany({
            where: {
              id: existing.id,
              responseBody: { equals: Prisma.DbNull },
            },
          });
          continue;
        }
        throw this.inProgress();
      }
    }

    let result: T;
    try {
      result = await fn();
    } catch (error) {
      // A failed write must not leave the key stuck "in progress": the retry has to run again.
      await this.prisma.idempotencyKey.delete({ where }).catch(() => undefined);
      throw error;
    }
    try {
      await this.prisma.idempotencyKey.update({
        where,
        data: {
          responseBody: JSON.parse(
            JSON.stringify(result ?? null),
          ) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // The write committed. Do not fail the request: a retry would 409 until the row goes stale.
      this.log.error('Could not store the idempotent response', error);
    }
    return { result, replayed: false };
  }

  /** Delete rows older than the retention window; called by the daily sweep. Returns how many. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.idempotencyKey.deleteMany({
      where: {
        createdAt: {
          lt: new Date(now.getTime() - IDEMPOTENCY_RETENTION_DAYS * DAY_MS),
        },
      },
    });
    return count;
  }

  private assertKey(key: string): void {
    if (!KEY_PATTERN.test(key)) {
      throw new HttpException(
        {
          message:
            'Idempotency-Key must be 8-128 characters of letters, digits, "_", ".", ":" or "-"',
          code: ExceptionCode.VALIDATION_ERROR,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private reused(): HttpException {
    return new HttpException(
      {
        message:
          'This Idempotency-Key was already used with a different request',
        code: ExceptionCode.IDEMPOTENCY_KEY_REUSED,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private inProgress(): HttpException {
    return new HttpException(
      {
        message:
          'An identical request with this Idempotency-Key is already in progress',
        code: ExceptionCode.IDEMPOTENCY_IN_PROGRESS,
      },
      HttpStatus.CONFLICT,
    );
  }
}
