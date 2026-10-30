import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentFarmId } from 'src/common/decorators';
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
  constructor(private readonly types: AnimalEventTypesService) {}

  /** The event catalogue with chip eligibility (worker can read). */
  @Get('types')
  @RequirePermission('cattle.read')
  listTypes(@CurrentFarmId() farmId: string) {
    return this.types.list(farmId);
  }
}
