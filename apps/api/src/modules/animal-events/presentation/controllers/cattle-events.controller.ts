import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { eventError } from '../../application/parse-payload';
import { EventRegistry } from '../../domain/event-registry';
import { AnimalEventWriteService } from '../../application/services/animal-event-write.service';
import { EVENT_REGISTRY } from '../../application/services/animal-event-types.service';
import { TimelineService } from '../../application/services/timeline.service';
import { EligibilityService } from '../../application/services/eligibility.service';
import { AnimalEventEditService } from '../../application/services/animal-event-edit.service';
import { EditEventDto, VoidEventDto } from '../dto/edit-event.dto';
import { RecordEventDto } from '../dto/record-event.dto';
import {
  EligibleEventsDto,
  ListCattleEventsDto,
} from '../dto/list-cattle-events.dto';

@ApiBearerAuth()
@Controller('cattle/:id/events')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class CattleEventsController {
  constructor(
    private readonly timeline: TimelineService,
    private readonly eligibility: EligibilityService,
    private readonly writer: AnimalEventWriteService,
    private readonly permissions: PermissionService,
    private readonly edits: AnimalEventEditService,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  /**
   * Record any event (RAKHAL-481). `?dryRun=true` returns findings and writes
   * nothing. Needs `cattle.event` plus the type's own permission.
   */
  @Post()
  @RequirePermission('cattle.event')
  async record(
    @Req() req: Request & { auth: { user: { permissionsVersion: number } } },
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Query('dryRun') dryRun: string | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: RecordEventDto,
  ) {
    const def = this.registry.get(dto.type);
    if (!def) {
      throw eventError('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
    }
    await this.permissions.assertPermissions(
      userId,
      farmId,
      req.auth.user.permissionsVersion,
      [def.permission],
    );
    return this.writer.record(farmId, userId, id, dto, {
      dryRun: dryRun === 'true' || dryRun === '1',
      idempotencyKey,
    });
  }

  /**
   * Edit the date or note of an event (RAKHAL-488). Author within 24 h, or a
   * manager (`cattle.event.void`) any time.
   */
  @Patch(':eventId')
  @RequirePermission('cattle.event')
  editEvent(
    @Req() req: Request & { auth: { user: { permissionsVersion: number } } },
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: EditEventDto,
  ) {
    return this.edits.edit(
      farmId,
      { userId, permissionsVersion: req.auth.user.permissionsVersion },
      id,
      eventId,
      dto,
    );
  }

  /** Void an event: reverses finance / stock where the domain can, voids the header, re-derives state. */
  @Post(':eventId/void')
  @RequirePermission('cattle.event')
  voidEvent(
    @Req() req: Request & { auth: { user: { permissionsVersion: number } } },
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: VoidEventDto,
  ) {
    return this.edits.void(
      farmId,
      { userId, permissionsVersion: req.auth.user.permissionsVersion },
      id,
      eventId,
      dto.reason,
    );
  }

  /** Event types this animal can take now (`?date=` to check a past date). */
  @Get('eligible')
  @RequirePermission('cattle.read')
  eligible(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: EligibleEventsDto,
  ) {
    return this.eligibility.eligible(
      farmId,
      id,
      query.date ? new Date(query.date) : undefined,
    );
  }

  /** Unified timeline for one animal (worker can read). */
  @Get()
  @RequirePermission('cattle.read')
  list(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Query() query: ListCattleEventsDto,
  ) {
    return this.timeline.list(farmId, id, query);
  }
}
