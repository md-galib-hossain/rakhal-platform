import { Inject, Injectable } from '@nestjs/common';
import { EventTypeDefinition } from '../../domain/catalogue';
import { EventRegistry } from '../../domain/event-registry';
import { toDefinition } from '../../domain/custom-type';
import { CustomEventTypeService } from './custom-event-type.service';

export const EVENT_REGISTRY = Symbol('EVENT_REGISTRY');

/**
 * Serves the event-type catalogue (RAKHAL-478). Today this is the code
 * catalogue as-is; farm custom types (RAKHAL-486) and follow-up rule toggles
 * (RAKHAL-484) will be merged in here later.
 */
@Injectable()
export class AnimalEventTypesService {
  constructor(
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
    private readonly customTypes: CustomEventTypeService,
  ) {}

  /** The code catalogue plus the farm's own types (RAKHAL-486). */
  async list(farmId: string): Promise<EventTypeDefinition[]> {
    const custom = await this.customTypes.list(farmId);
    return [
      ...this.registry.all(),
      ...custom.map((row) => ({
        ...toDefinition(row),
        customTypeId: row.id,
        name: row.name,
        fields: row.fields,
        followUpDays: row.followUpDays,
      })),
    ];
  }
}
