import { Injectable, OnModuleInit } from '@nestjs/common';
import { parsePayload } from 'src/modules/animal-events/application/parse-payload';
import {
  EventHandler,
  EventHandlerRegistry,
  HandlerInput,
  HandlerResult,
} from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { CreateAbortionEventDto } from '../../presentation/dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../../presentation/dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../../presentation/dto/create-calving-event.dto';
import { CreateDryOffDto } from '../../presentation/dto/create-dry-off.dto';
import { CreateHeatEventDto } from '../../presentation/dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../../presentation/dto/create-pregnancy-diagnosis.dto';
import { ReproductionService } from '../services/reproduction.service';

/**
 * RAKHAL-481: HEAT, BREEDING, PREG_CHECK, CALVING, ABORTION and DRY_OFF go
 * through the EXISTING `ReproductionService` methods. The payload is the legacy
 * route's body minus `cattleId` and the date field (taken from `eventAt`).
 */
@Injectable()
export class ReproductionEventHandler implements EventHandler, OnModuleInit {
  constructor(
    private readonly repro: ReproductionService,
    private readonly registry: EventHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      ['HEAT', 'BREEDING', 'PREG_CHECK', 'CALVING', 'ABORTION', 'DRY_OFF'],
      this,
    );
  }

  async handle(
    type: AnimalEventTypeKey,
    i: HandlerInput,
  ): Promise<HandlerResult> {
    const at = i.eventAt.toISOString();
    const base: Record<string, unknown> = {
      ...i.payload,
      cattleId: i.cattleId,
    };
    if (i.notes && base.notes === undefined) base.notes = i.notes;

    switch (type) {
      case 'HEAT': {
        const dto = await parsePayload(CreateHeatEventDto, {
          ...base,
          heatDateTime: at,
        });
        return {
          detail: await this.repro.createHeatEvent(
            i.farmId,
            dto,
            undefined,
            i.userId,
          ),
        };
      }
      case 'BREEDING': {
        const raw: Record<string, unknown> = { ...base, breedingDate: at };
        let headerData: Record<string, unknown> | undefined;
        if (i.provenance === 'HISTORICAL') {
          // Hub Q6: a history AI cost is information only: no straw used, no
          // expense posted. Keep what the farmer typed on the header.
          headerData = {
            historyCost: raw.serviceCost ?? null,
            historySemen: raw.sireNameOrCode ?? null,
          };
          raw.semenSource = 'EXTERNAL';
          delete raw.serviceProviderId;
          delete raw.semenBatchId;
          delete raw.paymentMethod;
          raw.serviceCost = 0;
        }
        const dto = await parsePayload(CreateBreedingEventDto, raw);
        const detail = await this.repro.createBreedingEvent(
          i.farmId,
          i.userId,
          dto,
        );
        return { detail, headerData };
      }
      case 'PREG_CHECK': {
        const dto = await parsePayload(CreatePregnancyDiagnosisDto, {
          result: 'PREGNANT',
          diagnosisMethod: 'PALPATION',
          ...base,
          diagnosisDate: at,
        });
        return {
          detail: await this.repro.createPregnancyDiagnosis(
            i.farmId,
            i.userId,
            dto,
          ),
        };
      }
      case 'CALVING': {
        const dto = await parsePayload(CreateCalvingEventDto, {
          ...base,
          calvingDate: at,
        });
        return {
          detail: await this.repro.createCalvingEvent(i.farmId, i.userId, dto),
        };
      }
      case 'ABORTION': {
        const dto = await parsePayload(CreateAbortionEventDto, {
          ...base,
          abortionDate: at,
        });
        return {
          detail: await this.repro.createAbortionEvent(i.farmId, dto, i.userId),
        };
      }
      default: {
        // DRY_OFF: the legacy route takes the cow id in the path, not the body.
        const rest = { ...base };
        delete rest.cattleId;
        const dto = await parsePayload(CreateDryOffDto, {
          ...rest,
          dryOffDate: at,
        });
        return {
          detail: await this.repro.recordDryOff(
            i.farmId,
            i.cattleId,
            dto,
            i.userId,
          ),
        };
      }
    }
  }
}
