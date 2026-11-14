import { Injectable, OnModuleInit } from '@nestjs/common';
import { parsePayload } from 'src/modules/animal-events/application/parse-payload';
import {
  EventHandler,
  EventHandlerRegistry,
  HandlerInput,
  HandlerResult,
} from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { RecordBcsDto } from '../../presentation/dto/record-bcs.dto';
import { RecordWeightDto } from '../../presentation/dto/record-weight.dto';
import { BcsService } from '../services/bcs.service';
import { WeightService } from '../services/weight.service';

/** RAKHAL-481: WEIGHT and BCS through the existing cattle services. */
@Injectable()
export class CattleEventHandler implements EventHandler, OnModuleInit {
  constructor(
    private readonly weights: WeightService,
    private readonly bcs: BcsService,
    private readonly registry: EventHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(['WEIGHT', 'BCS'], this);
  }

  async handle(
    type: AnimalEventTypeKey,
    i: HandlerInput,
  ): Promise<HandlerResult> {
    const raw = {
      ...i.payload,
      date: i.eventAt.toISOString(),
      notes: i.notes ?? i.payload.notes,
    };
    if (type === 'WEIGHT') {
      const dto = await parsePayload(RecordWeightDto, raw);
      const res = await this.weights.recordWeight(
        i.farmId,
        i.userId,
        i.cattleId,
        dto,
      );
      return { detail: res.record };
    }
    const dto = await parsePayload(RecordBcsDto, raw);
    const res = await this.bcs.recordBcs(i.farmId, i.userId, i.cattleId, dto);
    return { detail: res.record };
  }
}
