import { UnprocessableEntityException } from '@nestjs/common';
import { ExceptionCode } from 'src/common/exceptions/exception-codes.enum';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

/**
 * 422 for the event API. The global filter only emits its own `ExceptionCode`s,
 * so the event-specific code travels in `details.eventCode`.
 */
export function eventError(
  eventCode: string,
  message: string,
  extra: Record<string, unknown> = {},
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: ExceptionCode.VALIDATION_ERROR,
    message,
    details: { eventCode, ...extra },
  });
}

/**
 * Validate a free-form event `payload` against a domain DTO class (the same
 * class the legacy route uses), so the new API cannot let bad data reach the
 * domain services. Throws 422 `EVENT_PAYLOAD_INVALID`.
 */
export async function parsePayload<T extends object>(
  cls: new () => T,
  raw: Record<string, unknown>,
): Promise<T> {
  const dto = plainToInstance(cls, raw);
  const errors = await validate(dto, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  if (errors.length) {
    throw eventError('EVENT_PAYLOAD_INVALID', 'Event payload is invalid', {
      fields: errors.map((e) => ({
        field: e.property,
        errors: Object.values(e.constraints ?? {}),
      })),
    });
  }
  return dto;
}
