import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
  type ApiResponseOptions,
} from '@nestjs/swagger';
import type { CursorPageMeta } from 'src/common/pagination/cursor-page.type';

/**
 * OpenAPI description of the success envelope that `ResponseEnvelopeInterceptor` wraps around every
 * controller return value: `{ success: true, data, meta? }`.
 *
 * The swagger compiler plugin cannot see that interceptor, so without these decorators a route's
 * generated response type is either missing or describes only the inner object. Use one decorator per
 * route; the schema that results is what the typed clients (`@rakhal/api-client`) are generated from.
 * See RD-140. Runtime behaviour is unchanged: these only add documentation metadata.
 *
 *   @ApiEnvelopeResponse(MilkAvailabilityResponseDto)                 // { success, data: Dto }
 *   @ApiEnvelopeResponse(MilkQualityTestResponseDto, { status: 201 }) // create
 *   @ApiPaginatedResponse(MilkQualityTestResponseDto)                 // { success, data: Dto[], meta }
 *
 * A service that returns `null`/`undefined` is NOT wrapped by the interceptor: the client gets HTTP 200
 * with an empty body, never `{ success: true, data: null }`. Say so in `description` on such routes.
 */

/** Documented shape of `CursorPageMeta` (a class, so it can be referenced from a schema). */
export class CursorPageMetaDto implements CursorPageMeta {
  @ApiProperty({
    description: 'Number of items actually returned on this page.',
  })
  count!: number;

  @ApiProperty({ description: 'The page size that was requested.' })
  limit!: number;

  @ApiProperty({
    description:
      'True when another page exists after this one (fetch with `endCursor`).',
  })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'True when this page was requested with a cursor.',
  })
  hasPreviousPage!: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Cursor of the first item on this page (null when empty).',
  })
  startCursor!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor` to fetch the next page (null when empty).',
  })
  endCursor!: string | null;
}

interface EnvelopeOptions {
  /** HTTP status of the success response. Defaults to 200 (use 201 for creates). */
  status?: number;
  description?: string;
}

type SchemaObject = Extract<ApiResponseOptions, { schema: unknown }>['schema'];

const SUCCESS: SchemaObject = { type: 'boolean', enum: [true] };

/** `{ success: true, data: Model }` */
export function ApiEnvelopeResponse<T>(
  model: Type<T>,
  options: EnvelopeOptions = {},
): MethodDecorator & ClassDecorator {
  const ref = { $ref: getSchemaPath(model) };
  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        type: 'object',
        required: ['success', 'data'],
        properties: {
          success: SUCCESS,
          data: ref,
        },
      },
    }),
  );
}

/** `{ success: true, data: Model[], meta: CursorPageMeta }` (the interceptor hoists `{ items, meta }`). */
export function ApiPaginatedResponse<T>(
  model: Type<T>,
  options: EnvelopeOptions = {},
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(model, CursorPageMetaDto),
    ApiResponse({
      status: options.status ?? 200,
      description: options.description,
      schema: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: SUCCESS,
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
          meta: { $ref: getSchemaPath(CursorPageMetaDto) },
        },
      },
    }),
  );
}
