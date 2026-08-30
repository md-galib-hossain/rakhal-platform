import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { TaskService } from '../../application/services/task.service';
import { CreateTaskDto } from '../dto/create-task.dto';
import { UpdateTaskDto } from '../dto/update-task.dto';
import { ListTaskQueryDto } from '../dto/list-task-query.dto';
import { CompleteTaskDto, CancelTaskDto } from '../dto/complete-task.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/**
 * Task Hub (PRD Â§17). `/api/v1/tasks`. Token tenancy + RBAC.
 * Workers (task.read + task.complete) can view and finish tasks; create/edit/
 * reassign/delete require manager-level grants (task.create/update/delete).
 */
@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Get()
  @RequirePermission('task.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Query() query: ListTaskQueryDto,
  ) {
    return this.taskService.findAll(farmId, userId, query);
  }

  @Post()
  @RequirePermission('task.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.taskService.create(farmId, userId, dto);
  }

  @Get(':id')
  @RequirePermission('task.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.taskService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('task.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.taskService.update(farmId, id, dto);
  }

  @Post(':id/complete')
  @RequirePermission('task.complete')
  complete(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.taskService.complete(farmId, userId, id, dto);
  }

  /** Undo a mistaken `complete()` — manager+ only (task.update), keeps the source-event link. */
  @Post(':id/reopen')
  @RequirePermission('task.update')
  reopen(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.taskService.reopen(farmId, id);
  }

  /** User-initiated cancellation — manager+ only (task.update), not valid from COMPLETED. */
  @Post(':id/cancel')
  @RequirePermission('task.update')
  cancel(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: CancelTaskDto,
  ) {
    return this.taskService.cancel(farmId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('task.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.taskService.remove(farmId, id);
  }
}
