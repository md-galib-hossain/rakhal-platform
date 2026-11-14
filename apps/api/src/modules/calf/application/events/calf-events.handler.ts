import { Injectable, OnModuleInit } from '@nestjs/common';
import { parsePayload } from 'src/modules/animal-events/application/parse-payload';
import {
  EventHandler,
  EventHandlerRegistry,
  HandlerInput,
  HandlerResult,
} from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { WeanCalfDto } from '../../presentation/dto/wean-calf.dto';
import { CalfService } from '../services/calf.service';

/** RAKHAL-481: WEANING through the existing `CalfService.wean`. */
@Injectable()
export class CalfEventHandler implements EventHandler, OnModuleInit {
  constructor(
    private readonly calves: CalfService,
    private readonly registry: EventHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(['WEANING'], this);
  }

  async handle(
    _type: AnimalEventTypeKey,
    i: HandlerInput,
  ): Promise<HandlerResult> {
    const dto = await parsePayload(WeanCalfDto, {
      ...i.payload,
      weaningDate: i.eventAt.toISOString(),
      notes: i.notes ?? i.payload.notes,
    });
    return { detail: await this.calves.wean(i.farmId, i.cattleId, dto) };
  }
}
