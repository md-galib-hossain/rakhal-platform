import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReproPregnancyOutcome,
  ReproProtocolStatus,
  TaskCategory,
  TaskSource,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { getCursorArgs, toCursorPage } from 'src/common/pagination';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { SemenService } from 'src/modules/inventory/application/services/semen.service';
import { summarizeProtocol } from '../../domain/protocol-metrics';
import {
  ApplyProtocolDto,
  CloseInstanceDto,
  ListInstanceQueryDto,
  RecordAiDto,
  RecordOutcomeDto,
} from '../../presentation/dto/protocol.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STATUSES: ReproProtocolStatus[] = [
  ReproProtocolStatus.DRAFT,
  ReproProtocolStatus.SCHEDULED,
  ReproProtocolStatus.IN_PROGRESS,
];

type InstanceWithProtocol = Prisma.ReproProtocolInstanceGetPayload<{
  include: { protocol: { select: { name: true; code: true } } };
}>;

/**
 * Reproductive (Synchronization) Protocols (RAKHAL-214, PRD §9.8/§9.9, ADR-013).
 * Apply a protocol (Ovsynch, CIDR-Synch, …) to cows → one instance per cow + the
 * GnRH/PGF₂α/AI/PD steps as Task-Hub tasks. Tracks the **protocol status** and the
 * **pregnancy outcome** as two separate tracks. Reads Cattle by plain FK (validated
 * here) — the feed-module decoupling pattern.
 */
@Injectable()
export class ReproProtocolService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly taskService: TaskService,
    private readonly semenService: SemenService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReproProtocolService.name);
  }

  // ---- protocols ----------------------------------------------------------

  /** System-default + this farm's protocols, each with its card metrics. */
  async listProtocols(farmId: string) {
    const [protocols, instances] = await Promise.all([
      this.prisma.reproProtocol.findMany({
        where: {
          isActive: true,
          OR: [{ farmId }, { farmId: null, isSystemDefault: true }],
        },
        include: { _count: { select: { steps: true } } },
        orderBy: [{ isSystemDefault: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.reproProtocolInstance.findMany({
        where: { farmId },
        select: {
          protocolId: true,
          status: true,
          aiCompletedAt: true,
          pregnancyOutcome: true,
        },
      }),
    ]);

    const byProtocol = new Map<string, typeof instances>();
    for (const i of instances) {
      const arr = byProtocol.get(i.protocolId) ?? [];
      arr.push(i);
      byProtocol.set(i.protocolId, arr);
    }

    return protocols.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      description: p.description,
      duration_days: p.durationDays,
      step_count: p._count.steps,
      is_system_default: p.isSystemDefault,
      editable: !p.isSystemDefault,
      metrics: summarizeProtocol(byProtocol.get(p.id) ?? []),
    }));
  }

  async getProtocol(farmId: string, id: string) {
    const protocol = await this.prisma.reproProtocol.findFirst({
      where: {
        id,
        isActive: true,
        OR: [{ farmId }, { farmId: null, isSystemDefault: true }],
      },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!protocol) throw new NotFoundException('Protocol not found');
    return {
      id: protocol.id,
      name: protocol.name,
      code: protocol.code,
      description: protocol.description,
      duration_days: protocol.durationDays,
      is_system_default: protocol.isSystemDefault,
      steps: protocol.steps.map((s) => ({
        day_number: s.dayNumber,
        title: s.title,
        step_type: s.stepType,
        instruction: s.instruction,
        is_required: s.isRequired,
      })),
    };
  }

  // ---- apply --------------------------------------------------------------

  async apply(farmId: string, userId: string, dto: ApplyProtocolDto) {
    const protocol = await this.prisma.reproProtocol.findFirst({
      where: {
        id: dto.protocolId,
        isActive: true,
        OR: [{ farmId }, { farmId: null, isSystemDefault: true }],
      },
      include: { steps: { orderBy: { dayNumber: 'asc' } } },
    });
    if (!protocol) throw new NotFoundException('Protocol not found');
    if (protocol.steps.length === 0) {
      throw new BadRequestException('Protocol has no steps to schedule');
    }

    const cattleIds = [...new Set(dto.cattleIds)];
    const validCount = await this.prisma.cattle.count({
      where: { id: { in: cattleIds }, farmId, isActive: true },
    });
    if (validCount !== cattleIds.length) {
      throw new BadRequestException(
        'One or more cattle do not belong to this farm',
      );
    }

    const start = dto.startDate
      ? this.dayStart(dto.startDate)
      : this.dayStart();
    const status =
      start.getTime() > Date.now()
        ? ReproProtocolStatus.SCHEDULED
        : ReproProtocolStatus.IN_PROGRESS;
    const firstStepDay = protocol.steps[0].dayNumber;

    const instanceIds: string[] = [];
    for (const cattleId of cattleIds) {
      const instance = await this.prisma.reproProtocolInstance.create({
        data: {
          farmId,
          protocolId: protocol.id,
          cattleId,
          startDate: start,
          status,
          currentStepDay: firstStepDay,
          createdBy: userId,
        },
      });
      for (const step of protocol.steps) {
        await this.taskService.createInternal({
          farmId,
          createdBy: userId,
          name: `${protocol.name} — ${step.title}`,
          details: step.instruction ?? undefined,
          category: TaskCategory.BREEDING,
          dueAt: this.addDays(start, step.dayNumber),
          source: TaskSource.SYSTEM_AUTO,
          relatedCattleId: cattleId,
          sourceEventType: 'REPRO_PROTOCOL_INSTANCE',
          sourceEventId: instance.id,
        });
      }
      instanceIds.push(instance.id);
    }

    this.log.info('Reproductive protocol applied', {
      farmId,
      protocolId: protocol.id,
      cows: cattleIds.length,
    });
    return {
      protocol_id: protocol.id,
      applied: cattleIds.length,
      tasks_created: cattleIds.length * protocol.steps.length,
      instance_ids: instanceIds,
    };
  }

  // ---- instance lifecycle -------------------------------------------------

  async listInstances(farmId: string, query: ListInstanceQueryDto) {
    const rows = await this.prisma.reproProtocolInstance.findMany({
      where: {
        farmId,
        ...(query.protocolId ? { protocolId: query.protocolId } : {}),
        ...(query.cattleId ? { cattleId: query.cattleId } : {}),
        ...(query.status
          ? { status: query.status as ReproProtocolStatus }
          : {}),
      },
      include: { protocol: { select: { name: true, code: true } } },
      orderBy: [{ createdAt: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });
    const page = toCursorPage(rows, query);
    return {
      items: page.items.map((r) => this.mapInstance(r)),
      meta: page.meta,
    };
  }

  async getInstance(farmId: string, id: string) {
    return this.mapInstance(await this.getInstanceOrThrow(farmId, id));
  }

  /** Record the timed-AI step as done — the AI milestone + protocol Completed. */
  async recordAi(farmId: string, userId: string, id: string, dto: RecordAiDto) {
    const instance = await this.getInstanceOrThrow(farmId, id);
    if (!ACTIVE_STATUSES.includes(instance.status)) {
      throw new BadRequestException(
        `Cannot record AI — protocol is ${instance.status}`,
      );
    }
    if (dto.semenBatchId) {
      await this.semenService.decrementStraw(farmId, dto.semenBatchId, 1);
    }
    const aiAt = dto.aiDate ? new Date(dto.aiDate) : new Date();
    const updated = await this.prisma.reproProtocolInstance.update({
      where: { id },
      data: {
        aiCompletedAt: aiAt,
        completedAt: aiAt,
        status: ReproProtocolStatus.COMPLETED,
        pregnancyOutcome: ReproPregnancyOutcome.WAITING_PD,
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
      include: { protocol: { select: { name: true, code: true } } },
    });
    this.log.info('Protocol AI recorded', { farmId, instanceId: id });
    return this.mapInstance(updated);
  }

  /** Record the pregnancy outcome at the PD check — independent of protocol status. */
  async recordOutcome(
    farmId: string,
    userId: string,
    id: string,
    dto: RecordOutcomeDto,
  ) {
    const instance = await this.getInstanceOrThrow(farmId, id);
    if (!instance.aiCompletedAt) {
      throw new BadRequestException(
        'Record the AI step before the pregnancy outcome',
      );
    }
    const updated = await this.prisma.reproProtocolInstance.update({
      where: { id },
      data: {
        pregnancyOutcome: dto.outcome,
        outcomeRecordedAt: new Date(),
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
      include: { protocol: { select: { name: true, code: true } } },
    });
    this.log.info('Protocol pregnancy outcome recorded', {
      farmId,
      instanceId: id,
      outcome: dto.outcome,
    });
    return this.mapInstance(updated);
  }

  /** Cancel or fail an in-flight instance (a Completed instance can't be closed). */
  async closeInstance(
    farmId: string,
    userId: string,
    id: string,
    dto: CloseInstanceDto,
  ) {
    const instance = await this.getInstanceOrThrow(farmId, id);
    if (instance.status === ReproProtocolStatus.COMPLETED) {
      throw new BadRequestException('A completed protocol cannot be closed');
    }
    const updated = await this.prisma.reproProtocolInstance.update({
      where: { id },
      data: {
        status: dto.status,
        endReason: dto.reason,
        completedAt: new Date(),
      },
      include: { protocol: { select: { name: true, code: true } } },
    });
    return this.mapInstance(updated);
  }

  /** Herd-wide reproductive KPIs (§9.9) — headline rates from the two tracks. */
  async kpis(farmId: string) {
    const instances = await this.prisma.reproProtocolInstance.findMany({
      where: { farmId },
      select: {
        status: true,
        aiCompletedAt: true,
        pregnancyOutcome: true,
      },
    });
    const m = summarizeProtocol(instances);
    return {
      total_applied: m.applied,
      in_progress: m.in_progress,
      completed: m.completed,
      ai_completed: m.ai_completed,
      pregnant: m.pregnant,
      open: m.open,
      pregnancy_loss: m.pregnancy_loss,
      conception_rate: m.conception_rate,
      pregnancy_loss_rate:
        m.pregnant + m.pregnancy_loss > 0
          ? Math.round(
              (m.pregnancy_loss / (m.pregnant + m.pregnancy_loss)) * 1000,
            ) / 10
          : null,
    };
  }

  // ---- internals ----------------------------------------------------------

  private async getInstanceOrThrow(
    farmId: string,
    id: string,
  ): Promise<InstanceWithProtocol> {
    const instance = await this.prisma.reproProtocolInstance.findFirst({
      where: { id, farmId },
      include: { protocol: { select: { name: true, code: true } } },
    });
    if (!instance) throw new NotFoundException('Protocol instance not found');
    return instance;
  }

  private mapInstance(row: InstanceWithProtocol) {
    return {
      id: row.id,
      protocol_id: row.protocolId,
      protocol_name: row.protocol.name,
      cattle_id: row.cattleId,
      start_date: row.startDate,
      status: row.status,
      current_step_day: row.currentStepDay,
      ai_completed_at: row.aiCompletedAt,
      pregnancy_outcome: row.pregnancyOutcome,
      outcome_recorded_at: row.outcomeRecordedAt,
      completed_at: row.completedAt,
      end_reason: row.endReason,
      notes: row.notes,
      created_at: row.createdAt,
    };
  }

  private dayStart(dateStr?: string): Date {
    const d = dateStr ? new Date(dateStr) : new Date();
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  private addDays(date: Date, n: number): Date {
    return new Date(date.getTime() + n * DAY_MS);
  }
}
