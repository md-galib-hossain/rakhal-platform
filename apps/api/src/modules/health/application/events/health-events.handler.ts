import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { parsePayload } from 'src/modules/animal-events/application/parse-payload';
import {
  EventHandler,
  EventHandlerRegistry,
  HandlerInput,
  HandlerResult,
} from 'src/modules/animal-events/application/event-handler';
import { AnimalEventTypeKey } from 'src/modules/animal-events/domain/catalogue';
import { CreateHealthCaseDto } from '../../presentation/dto/create-health-case.dto';
import {
  LogTreatmentDto,
  RecordTreatmentDto,
} from '../../presentation/dto/case-actions.dto';
import { HealthService } from '../services/health.service';

const OPEN_STATUSES = ['ACTIVE', 'IMPROVING', 'WORSENING', 'STABLE'] as const;

/**
 * RAKHAL-481 follow-up (RD-130): ILLNESS, TREATMENT, VACCINATION and DEWORMING
 * through the EXISTING `HealthService`:
 * - ILLNESS         -> `createHealthCase` (duplicate rule becomes the finding OPEN_CASE_EXISTS)
 * - VACCINATION /
 *   DEWORMING       -> `recordTreatment` (Quick Treat, PREVENTIVE care type): needs no open case
 * - TREATMENT       -> `logTreatment` on the animal's open case, else `recordTreatment` (CURATIVE),
 *                      which opens a case (finding TREATMENT_NEW_CASE)
 * Payload: `medicineId` (optional batch), `medicineName`, `doseAmount`, `doseUnit`, `doseUnitId`,
 * `route`, `vetCost`, `financialAccountId`, `nextDoseDays` (kept on the header), plus ILLNESS
 * `condition` / `severity` (LOW|MEDIUM|HIGH|CRITICAL) / `symptoms`.
 */
@Injectable()
export class HealthEventHandler implements EventHandler, OnModuleInit {
  constructor(
    private readonly health: HealthService,
    private readonly prisma: PrismaService,
    private readonly registry: EventHandlerRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(
      ['ILLNESS', 'TREATMENT', 'VACCINATION', 'DEWORMING'],
      this,
    );
  }

  private openCase(cattleId: string, condition?: string) {
    return this.prisma.healthCase.findFirst({
      where: {
        cattleId,
        deletedAt: null,
        status: { in: [...OPEN_STATUSES] },
        ...(condition ? { condition: condition as never } : {}),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  /** Warnings the write API adds before saving (dry run + real run). */
  async findingsFor(
    type: AnimalEventTypeKey,
    i: Pick<HandlerInput, 'cattleId' | 'payload'>,
  ): Promise<string[]> {
    if (type === 'ILLNESS') {
      const cond =
        typeof i.payload.condition === 'string'
          ? i.payload.condition
          : undefined;
      return (await this.openCase(i.cattleId, cond))
        ? ['OPEN_CASE_EXISTS']
        : [];
    }
    if (type === 'TREATMENT') {
      return (await this.openCase(i.cattleId)) ? [] : ['TREATMENT_NEW_CASE'];
    }
    return [];
  }

  async handle(
    type: AnimalEventTypeKey,
    i: HandlerInput,
  ): Promise<HandlerResult> {
    const at = i.eventAt.toISOString();
    const p: Record<string, unknown> = { ...i.payload };
    const headerData: Record<string, unknown> = {};
    if (p.nextDoseDays != null) headerData.nextDoseDays = p.nextDoseDays;
    delete p.nextDoseDays;

    if (type === 'ILLNESS') {
      const dto = await parsePayload(CreateHealthCaseDto, {
        careType: 'CURATIVE',
        priority: p.severity ?? 'MEDIUM',
        note: i.notes,
        ...p,
        cattleId: i.cattleId,
        startDate: at,
      });
      const created = await this.health.createHealthCase(
        i.farmId,
        i.userId,
        dto,
      );
      headerData.healthCaseId = (created as { id?: string }).id ?? null;
      return { detail: created, headerData };
    }

    if (i.provenance === 'HISTORICAL') {
      // History entry: no stock, no cost, no expense. Keep the product by name.
      if (!p.medicineName && typeof p.medicineId === 'string') {
        const med = await this.prisma.medicine.findFirst({
          where: { id: p.medicineId, farmId: i.farmId },
          select: { name: true },
        });
        p.medicineName = med?.name;
      }
      headerData.historyCost = p.vetCost ?? null;
      p.outsideInventory = true;
      p.medicineName = p.medicineName ?? type.toLowerCase();
      delete p.medicineId;
      delete p.vetCost;
      delete p.financialAccountId;
    }

    if (type === 'TREATMENT') {
      const open = await this.openCase(i.cattleId);
      if (open) {
        const dto = await parsePayload(LogTreatmentDto, {
          ...p,
          notes: i.notes,
          administeredAt: at,
        });
        return {
          detail: await this.health.logTreatment(
            i.farmId,
            i.userId,
            open.id,
            dto,
          ),
          headerData,
        };
      }
    }

    const dto = await parsePayload(RecordTreatmentDto, {
      ...p,
      cattleIds: [i.cattleId],
      treatedAt: at,
      notes: i.notes,
      careType: type === 'TREATMENT' ? 'CURATIVE' : 'PREVENTIVE',
      reason: p.reason ?? type.toLowerCase(),
    });
    return {
      detail: await this.health.recordTreatment(i.farmId, i.userId, dto),
      headerData,
    };
  }
}
