import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { CurrentFarmId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { FollowUpService } from '../../application/services/follow-up.service';
import { FOLLOW_UP_RULES } from '../../domain/follow-up-rules';

class FollowUpRuleSettingDto {
  @IsIn(FOLLOW_UP_RULES.map((r) => r.key))
  ruleKey!: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Days from the trigger (or before expected calving). Null = back to the default. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(400)
  offsetDays?: number | null;
}

export class UpdateFollowUpRulesDto {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FollowUpRuleSettingDto)
  rules!: FollowUpRuleSettingDto[];
}

/** RAKHAL-484: per-farm switches and offsets for the code-defined follow-up rules. */
@ApiBearerAuth()
@Controller('settings/follow-up-rules')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class FollowUpRulesController {
  constructor(private readonly followUps: FollowUpService) {}

  @Get()
  @RequirePermission('settings.read')
  list(@CurrentFarmId() farmId: string) {
    return this.followUps.listRules(farmId);
  }

  @Put()
  @RequirePermission('settings.update')
  update(@CurrentFarmId() farmId: string, @Body() dto: UpdateFollowUpRulesDto) {
    return this.followUps.updateRules(farmId, dto.rules);
  }
}
