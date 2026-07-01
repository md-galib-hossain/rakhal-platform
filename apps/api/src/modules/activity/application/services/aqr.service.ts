import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { AqrEventDef, AqrEventKey } from '../../domain/aqr-events';
import { AqrConfigService } from './aqr-config.service';
import {
  ActivityLogService,
  ActivityTaggedValue,
} from './activity-log.service';

export interface AqrEventResult {
  cattleId: string;
  eventKey: AqrEventKey;
  delta: number | null;
  aqrScore: number | null;
}

export interface ApplyEventOptions {
  actorId?: string | null;
  actionDetails?: string;
  taggedValues?: ActivityTaggedValue[];
}

/**
 * AQR (Animal Quality Rating) engine (PRD §19.2/§19.4, §25.7). Applying an event:
 *  1. resolves the active event definition + clamp bounds via {@link AqrConfigService}
 *     (Admin-tunable — the engine holds NO hardcoded deltas/bounds),
 *  2. adjusts the cow's `aqrScore` (clamped to the resolved bounds, AQR-01) — or nullifies it,
 *  3. records the matching immutable Activity Log entry with the AQR delta (AQR-02).
 *
 * Herd AQR (AQR-03) is the mean of active, non-nullified cattle scores.
 * Modules inject this service and call `applyEvent(...)` on their domain events
 * (cattle registration, milk session, sickness, calving, …). Because every
 * tunable parameter is resolved through the config provider, the Rakhal Admin
 * panel can re-tune the algorithm (RAKHAL-110) without changing this engine.
 */
@Injectable()
export class AqrService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly config: AqrConfigService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(AqrService.name);
  }

  async applyEvent(
    farmId: string,
    cattleId: string,
    eventKey: AqrEventKey,
    options: ApplyEventOptions = {},
  ): Promise<AqrEventResult> {
    const def: AqrEventDef = await this.config.resolveEvent(farmId, eventKey);

    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: { id: true, name: true, tagNumber: true, aqrScore: true },
    });
    if (!cattle) {
      throw new NotFoundException('Cattle not found');
    }

    const bounds = await this.config.resolveBounds(farmId);
    const newScore = def.nullify
      ? null
      : this.clamp((cattle.aqrScore ?? 0) + def.delta, bounds.min, bounds.max);

    await this.prisma.cattle.update({
      where: { id: cattleId },
      data: { aqrScore: newScore },
    });

    const label = cattle.name ?? cattle.tagNumber;
    await this.activityLog.record({
      farmId,
      module: def.module,
      eventTitle: def.title,
      actionDetails: options.actionDetails ?? `${def.title} for [${label}].`,
      aqrImpact: def.nullify ? null : def.delta,
      actorId: options.actorId ?? null,
      relatedCattleId: cattleId,
      taggedValues: options.taggedValues ?? [
        { key: 'cattle', value: label },
        { key: 'tag', value: cattle.tagNumber },
      ],
    });

    this.log.info('AQR event applied', {
      cattleId,
      farmId,
      eventKey,
      delta: def.delta,
      newScore,
    });

    return {
      cattleId,
      eventKey,
      delta: def.nullify ? null : def.delta,
      aqrScore: newScore,
    };
  }

  /** Herd AQR = arithmetic mean of active, non-nullified cattle scores (AQR-03). */
  async herdAqr(farmId: string): Promise<number> {
    const agg = await this.prisma.cattle.aggregate({
      where: { farmId, isActive: true, aqrScore: { not: null } },
      _avg: { aqrScore: true },
    });
    return Math.round((agg._avg.aqrScore ?? 0) * 10) / 10;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
