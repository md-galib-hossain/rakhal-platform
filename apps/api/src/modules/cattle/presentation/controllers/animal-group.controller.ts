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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { AnimalGroupService } from '../../application/services/animal-group.service';
import { AnimalGroupMembersDto } from '../dto/animal-group-members.dto';
import { CreateAnimalGroupDto } from '../dto/create-animal-group.dto';
import { ListAnimalGroupQueryDto } from '../dto/list-animal-group-query.dto';
import { UpdateAnimalGroupDto } from '../dto/update-animal-group.dto';

/** Animal groups (RAKHAL-452). `/api/v1/animal-groups`. Token tenancy + RBAC. */
@ApiTags('Animal Groups')
@ApiBearerAuth()
@Controller('animal-groups')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class AnimalGroupController {
  constructor(private readonly groups: AnimalGroupService) {}

  @Post()
  @RequirePermission('cattle.bulk')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateAnimalGroupDto,
  ) {
    return this.groups.create(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('cattle.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListAnimalGroupQueryDto,
  ) {
    return this.groups.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('cattle.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.groups.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('cattle.bulk')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAnimalGroupDto,
  ) {
    return this.groups.update(farmId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('cattle.bulk')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.groups.remove(farmId, id);
  }

  @Post(':id/members')
  @RequirePermission('cattle.bulk')
  addMembers(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: AnimalGroupMembersDto,
  ) {
    return this.groups.addMembers(farmId, userId, id, dto.cattleIds);
  }

  @Delete(':id/members')
  @RequirePermission('cattle.bulk')
  removeMembers(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: AnimalGroupMembersDto,
  ) {
    return this.groups.removeMembers(farmId, id, dto.cattleIds);
  }
}
