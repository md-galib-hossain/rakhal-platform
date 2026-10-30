import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { CustomEventTypeService } from '../../application/services/custom-event-type.service';
import { CUSTOM_GROUPS } from '../../domain/custom-type';

export class CreateCustomTypeDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsIn(CUSTOM_GROUPS)
  group!: string;

  /** `{ FEMALE: 'LISTED' | 'WARN' | 'BLOCK', ... }`; missing chips are LISTED. */
  @IsOptional()
  @IsObject()
  appliesTo?: Record<string, string>;

  /** `[{ key, label, kind: 'number' | 'text' | 'select', unit?, options?, required? }]`, up to 20. */
  @IsArray()
  fields!: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  followUpDays?: number | null;
}

export class UpdateCustomTypeDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsIn(CUSTOM_GROUPS)
  group?: string;

  @IsOptional()
  @IsObject()
  appliesTo?: Record<string, string>;

  @IsOptional()
  @IsArray()
  fields?: unknown[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  followUpDays?: number | null;
}

/** RAKHAL-486: a farm's own event types. Read = any member; write = manager and above. */
@ApiBearerAuth()
@Controller('animal-events/custom-types')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class CustomTypesController {
  constructor(private readonly types: CustomEventTypeService) {}

  @Get()
  @RequirePermission('cattle.read')
  list(@CurrentFarmId() farmId: string) {
    return this.types.list(farmId);
  }

  @Post()
  @RequirePermission('cattle.update')
  create(@CurrentFarmId() farmId: string, @Body() dto: CreateCustomTypeDto) {
    return this.types.create(farmId, dto);
  }

  @Patch(':id')
  @RequirePermission('cattle.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCustomTypeDto,
  ) {
    return this.types.update(farmId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('cattle.update')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.types.deactivate(farmId, id);
  }
}
