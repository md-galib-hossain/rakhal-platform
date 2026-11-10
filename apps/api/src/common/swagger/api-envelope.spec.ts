import 'reflect-metadata';
import { ApiProperty } from '@nestjs/swagger';
import { ApiEnvelopeResponse, ApiPaginatedResponse } from './api-envelope';

class ThingDto {
  @ApiProperty() id!: string;
}

class Probe {
  @ApiEnvelopeResponse(ThingDto)
  one() {
    return null;
  }

  @ApiEnvelopeResponse(ThingDto, { status: 201, description: 'made' })
  created() {
    return null;
  }

  @ApiPaginatedResponse(ThingDto)
  many() {
    return null;
  }
}

interface StoredResponse {
  description?: string;
  schema: {
    type: string;
    required: string[];
    properties: Record<string, unknown>;
  };
}

/** swagger stores explicit responses under this key, keyed by HTTP status. */
function responses(method: keyof Probe): Record<string, StoredResponse> {
  return Reflect.getMetadata(
    'swagger/apiResponse',
    Probe.prototype[method],
  ) as Record<string, StoredResponse>;
}

describe('ApiEnvelopeResponse / ApiPaginatedResponse (RD-140)', () => {
  it('wraps a single model in { success: true, data }', () => {
    const r = responses('one');
    expect(Object.keys(r)).toEqual(['200']);
    expect(r['200'].schema).toEqual({
      type: 'object',
      required: ['success', 'data'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: { $ref: '#/components/schemas/ThingDto' },
      },
    });
  });

  it('honours status and description (create routes use 201)', () => {
    const r = responses('created');
    expect(Object.keys(r)).toEqual(['201']);
    expect(r['201'].description).toBe('made');
  });

  it('documents a paginated list as data: Model[] plus cursor meta', () => {
    const { schema } = responses('many')['200'];
    expect(schema.required).toEqual(['success', 'data', 'meta']);
    expect(schema.properties.data).toEqual({
      type: 'array',
      items: { $ref: '#/components/schemas/ThingDto' },
    });
    expect(schema.properties.meta).toEqual({
      $ref: '#/components/schemas/CursorPageMetaDto',
    });
  });
});
