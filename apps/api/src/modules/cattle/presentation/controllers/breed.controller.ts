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
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { BreedService } from '../../application/services/breed.service';
import { CreateBreedDto } from '../dto/create-breed.dto';
import { ListBreedQueryDto } from '../dto/list-breed-query.dto';
import { UpdateBreedDto } from '../dto/update-breed.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Breeds (PRD §8.4). `/api/v1/breeds`. Token tenancy + RBAC + subscription baseline. */
@ApiTags('Breeds')
@ApiBearerAuth()
@Controller('breeds')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class BreedController {
  constructor(private readonly breedService: BreedService) {}

  @Post()
  @RequirePermission('cattle.create')
  create(@CurrentFarmId() farmId: string, @Body() dto: CreateBreedDto) {
    return this.breedService.create(farmId, dto);
  }

  @Get()
  @RequirePermission('cattle.read')
  findAll(@CurrentFarmId() farmId: string, @Query() query: ListBreedQueryDto) {
    return this.breedService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('cattle.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.breedService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('cattle.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateBreedDto,
  ) {
    return this.breedService.update(farmId, id, dto);
  }

  @Patch(':id/archive')
  @RequirePermission('cattle.update')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.breedService.archive(farmId, id);
  }

  @Patch(':id/restore')
  @RequirePermission('cattle.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.breedService.restore(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('cattle.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.breedService.remove(farmId, id);
  }
}
