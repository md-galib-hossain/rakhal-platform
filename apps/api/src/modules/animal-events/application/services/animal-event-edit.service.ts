import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityLogModule, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { txStore } from 'src/core/database/prisma/tx-context';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { EventRegistry } from '../../domain/event-registry';
import type { RuleEvent } from '../../domain/follow-up-rules';
import { EventHandlerRegistry } from '../event-handler';
import { eventError } from '../parse-payload';
import { EVENT_REGISTRY } from './animal-event-types.service';
import { FollowUpService } from './follow-up.service';

/** Hub Q5: the author may edit / void within this window; manager and above at any time. */
export const AUTHOR_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface EditEventInput {
  eventAt?: string;
  notes?: string | null;
  reason?: string;
}

export interface Actor {
  userId: string;
  permissionsVersion: number;
}

/** Date column of each typed detail table: editing `eventAt` moves it (the DB trigger syncs the header). */
const DATE_FIELD: Record<string, { model: string; field: string }> = {
  HEAT: { model: 'heatEvent', field: 'heatDateTime' },
  BREEDING: { model: 'breedingEvent', field: 'breedingDate' },
  PREG_CHECK: { model: 'pregnancyDiagnosis', field: 'diagnosisDate' },
  CALVING: { model: 'calvingEvent', field: 'calvingDate' },
  ABORTION: { model: 'abortionEvent', field: 'abortionDate' },
  DRY_OFF: { model: 'dryPeriod', field: 'startDate' },
  WEIGHT: { model: 'weightRecord', field: 'recordedDate' },
  BCS: { model: 'bodyConditionScore', field: 'recordedDate' },
  TREATMENT: { model: 'treatmentLog', field: 'administeredAt' },
  VACCINATION: { model: 'treatmentLog', field: 'administeredAt' },
  DEWORMING: { model: 'treatmentLog', field: 'administeredAt' },
  WEANING: { model: 'calfWeaningRecord', field: 'weaningDate' },
};

/**
 * RAKHAL-488: uniform edit and void of one event. Authority (Q5): `cattle.event.void`
 * (manager and above) any time; otherwise only the author within 24 hours. A void
 * reverses the typed detail through its domain's own void when one exists, voids
 * the header, re-derives the stored state and cancels the event's open follow-ups.
 * Before/after goes to the Activity Log.
 */
@Injectable()
export class AnimalEventEditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly handlers: EventHandlerRegistry,
    private readonly followUps: FollowUpService,
    private readonly permissions: PermissionService,
    private readonly activity: ActivityLogService,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  private async load(farmId: string, cattleId: string, eventId: string) {
    const ev = await this.prisma.animalEvent.findFirst({
      where: { id: eventId, farmId, cattleId },
    });
    if (!ev) throw new NotFoundException('Event not found');
    return ev;
  }

  private async authorize(
    farmId: string,
    actor: Actor,
    ev: { recordedById: string; createdAt: Date },
  ) {
    const canVoid = await this.permissions.hasPermission(
      actor.userId,
      farmId,
      actor.permissionsVersion,
      ['cattle.event.void'],
    );
    if (canVoid) return;
    const isAuthor = ev.recordedById === actor.userId;
    const inWindow = Date.now() - ev.createdAt.getTime() <= AUTHOR_WINDOW_MS;
    if (!(isAuthor && inWindow)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message:
          'Only the author within 24 hours, or a manager, can change this event',
        details: { eventCode: 'EVENT_EDIT_WINDOW_CLOSED' },
      });
    }
  }

  async void(
    farmId: string,
    actor: Actor,
    cattleId: string,
    eventId: string,
    reason: string,
  ) {
    const ev = await this.load(farmId, cattleId, eventId);
    if (ev.status === 'VOIDED') {
      throw eventError('EVENT_ALREADY_VOIDED', 'This event is already voided');
    }
    await this.authorize(farmId, actor, ev);

    const handler = this.handlers.get(ev.type);
    const detailReversed = await this.prisma.$transaction(
      async (tx) =>
        txStore.run({ tx }, async () => {
          const reversed = handler?.voidEvent
            ? await handler.voidEvent(ev.type, {
                farmId,
                userId: actor.userId,
                cattleId,
                animalEventId: ev.id,
                reason,
              })
            : false;
          // The trigger already voided the header when the detail has a void column; make sure.
          await tx.animalEvent.update({
            where: { id: ev.id },
            data: {
              status: 'VOIDED',
              voidedAt: ev.voidedAt ?? new Date(),
              voidedById: actor.userId,
              voidReason: reason,
            },
          });
          await this.followUps.cancelForEvent(ev.id);
          await this.handlers.recomputeAll(farmId, cattleId);
          return reversed;
        }),
      { timeout: 30_000, maxWait: 10_000 },
    );

    await this.audit(farmId, actor.userId, cattleId, 'Animal event voided', {
      before: { status: ev.status, eventAt: ev.eventAt, notes: ev.notes },
      after: { status: 'VOIDED', reason },
      type: ev.type,
    });
    return {
      event: await this.prisma.animalEvent.findUniqueOrThrow({
        where: { id: ev.id },
      }),
      /** False when the domain has no reversal for this type: only the header was voided. */
      detailReversed,
    };
  }

  async edit(
    farmId: string,
    actor: Actor,
    cattleId: string,
    eventId: string,
    input: EditEventInput,
  ) {
    const ev = await this.load(farmId, cattleId, eventId);
    if (ev.status === 'VOIDED') {
      throw eventError(
        'EVENT_ALREADY_VOIDED',
        'A voided event cannot be edited',
      );
    }
    await this.authorize(farmId, actor, ev);

    const newAt = input.eventAt ? new Date(input.eventAt) : null;
    if (newAt && newAt.getTime() > Date.now()) {
      throw eventError(
        'EVENT_DATE_IN_FUTURE',
        'eventAt cannot be in the future',
      );
    }
    const moves = Boolean(newAt && newAt.getTime() !== ev.eventAt.getTime());
    const target = DATE_FIELD[ev.type];

    await this.prisma.$transaction(
      async (tx) =>
        txStore.run({ tx }, async () => {
          if (moves && newAt) {
            if (target) {
              // Move the typed row; the trigger carries the date to the header.
              const delegate = (
                tx as unknown as Record<
                  string,
                  { updateMany(args: unknown): Promise<unknown> }
                >
              )[target.model];
              await delegate.updateMany({
                where: { animalEventId: ev.id },
                data: { [target.field]: newAt },
              });
            }
            await tx.animalEvent.update({
              where: { id: ev.id },
              data: { eventAt: newAt },
            });
          }
          if (input.notes !== undefined) {
            await tx.animalEvent.update({
              where: { id: ev.id },
              data: { notes: input.notes },
            });
          }
          if (moves && newAt) {
            // Follow-ups were derived from the old date: cancel and derive again.
            await this.followUps.cancelForEvent(ev.id, {
              keepReminders: true,
            });
            // RAKHAL-487: custom reminders linked to this event follow its new date.
            await this.followUps.moveReminders(ev.id, newAt);
            const rule = await this.ruleEventFor(
              ev.id,
              ev.type,
              newAt,
              ev.data,
            );
            if (rule) {
              await this.followUps.onEventSaved({
                farmId,
                userId: actor.userId,
                cattleId,
                eventId: ev.id,
                event: rule,
              });
            }
          }
          await this.handlers.recomputeAll(farmId, cattleId);
        }),
      { timeout: 30_000, maxWait: 10_000 },
    );

    const after = await this.prisma.animalEvent.findUniqueOrThrow({
      where: { id: ev.id },
    });
    await this.audit(farmId, actor.userId, cattleId, 'Animal event edited', {
      before: { eventAt: ev.eventAt, notes: ev.notes },
      after: { eventAt: after.eventAt, notes: after.notes },
      type: ev.type,
    });
    return { event: after };
  }

  /** The rule input for an edited event, rebuilt from the header (and the diagnosis row for a check). */
  private async ruleEventFor(
    eventId: string,
    type: string,
    eventAt: Date,
    data: Prisma.JsonValue,
  ): Promise<RuleEvent | null> {
    const payload = (
      data && typeof data === 'object' && !Array.isArray(data) ? data : {}
    ) as Record<string, unknown>;
    if (type === 'PREG_CHECK') {
      const d = await this.prisma.pregnancyDiagnosis.findFirst({
        where: { animalEventId: eventId },
        select: { result: true, expectedCalvingDate: true, gestationDay: true },
      });
      return {
        type: 'PREG_CHECK',
        eventAt,
        payload,
        result: d?.result,
        expectedCalvingDate:
          d?.expectedCalvingDate ??
          (d?.gestationDay
            ? new Date(eventAt.getTime() + (280 - d.gestationDay) * 86400000)
            : null),
      };
    }
    if (['BREEDING', 'CALVING', 'HEAT', 'VACCINATION'].includes(type)) {
      return { type: type as RuleEvent['type'], eventAt, payload };
    }
    return null;
  }

  private async audit(
    farmId: string,
    userId: string,
    cattleId: string,
    title: string,
    details: Record<string, unknown>,
  ) {
    await this.activity.record({
      farmId,
      module: ActivityLogModule.COW_MANAGEMENT,
      eventTitle: title,
      actionDetails: `${title} (${String(details.type)}).`,
      actorId: userId,
      relatedCattleId: cattleId,
      taggedValues: [
        { key: 'before', value: JSON.stringify(details.before) },
        { key: 'after', value: JSON.stringify(details.after) },
      ],
    });
  }
}
