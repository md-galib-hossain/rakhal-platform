import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { eventError } from '../../application/parse-payload';
import { EventRegistry } from '../../domain/event-registry';
import { BulkEventService } from '../../application/services/bulk-event.service';
import { EVENT_REGISTRY } from '../../application/services/animal-event-types.service';
import { BulkEventDto } from '../dto/bulk-event.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { AnimalEventTypesService } from '../../application/services/animal-event-types.service';

@ApiBearerAuth()
@Controller('animal-events')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class AnimalEventsController {
  constructor(
    private readonly types: AnimalEventTypesService,
    private readonly bulkEvents: BulkEventService,
    private readonly permissions: PermissionService,
    @Inject(EVENT_REGISTRY) private readonly registry: EventRegistry,
  ) {}

  /**
   * Record one event type for up to 100 animals in one transaction (RAKHAL-489). `?dryRun=true`
   * returns who is eligible and writes nothing. Needs `cattle.bulk` + `cattle.event` + the type's own
   * permission.
   */
  @Post('bulk')
  @RequirePermission('cattle.bulk')
  async bulk(
    @Req() req: Request & { auth: { user: { permissionsVersion: number } } },
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Query('dryRun') dryRun: string | undefined,
    @Body() dto: BulkEventDto,
  ) {
    const def = this.registry.get(dto.type);
    if (!def) {
      throw eventError('EVENT_TYPE_UNKNOWN', `Unknown event type ${dto.type}`);
    }
    await this.permissions.assertPermissions(
      userId,
      farmId,
      req.auth.user.permissionsVersion,
      ['cattle.event', def.permission],
    );
    return this.bulkEvents.bulk(farmId, userId, dto, {
      dryRun: dryRun === 'true' || dryRun === '1',
    });
  }

  /** The event catalogue with chip eligibility (worker can read). */
  @Get('types')
  @RequirePermission('cattle.read')
  listTypes(@CurrentFarmId() farmId: string) {
    return this.types.list(farmId);
  }
}
