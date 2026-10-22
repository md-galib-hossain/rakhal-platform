import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FeedIngredientService } from 'src/modules/feed/application/services/feed-ingredient.service';
import { CreateCatalogueIngredientDto } from 'src/modules/feed/presentation/dto/create-catalogue-ingredient.dto';
import { UpdateCatalogueIngredientDto } from 'src/modules/feed/presentation/dto/update-catalogue-ingredient.dto';
import { AdminIpAllowlistGuard } from '../guards/admin-ip-allowlist.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AdminPermissionGuard } from '../guards/admin-permission.guard';
import { RequireAdminPermission } from '../decorators/require-admin-permission.decorator';
import { CurrentAdmin } from '../decorators/current-admin.decorator';
import type { CurrentAdminContext } from '../../domain/authenticated-admin-request.type';
import { AdminAuditService } from '../../application/services/admin-audit.service';

/**
 * Admin Feed Ingredient Master (RAKHAL-233, PRD §35.11 ADM-13/ADM-14 — user request 2026-07-17
 * "later from admin we can add ingredients and modify nutrition profiles"). CRUD over the **global**
 * ingredient catalogue (`FeedIngredient` rows with `farmId: null`); farms consume it read-only via
 * `GET /feed/ingredients` (`listMerged`) and can still layer their own price/nutrition override on
 * top (§4.3 — untouched by anything here). Reuses `FeedIngredientService` directly (no separate
 * admin-side service), same pattern as `AdminBillingController` reusing `CouponService`/
 * `ReferralService` — the module that owns the data owns the logic, admin just adds the guard +
 * audit layer. Dynamic pricing (ADM-14): a price change on `PATCH` takes effect immediately for
 * every farm's next formula computation (no caching/refresh step to invoke). CSV bulk import is
 * explicitly **not** built here — flagged as a follow-up, not faked.
 */
@ApiTags('Admin — Feed Ingredients')
@ApiBearerAuth()
@Controller('admin/feed-ingredients')
@UseGuards(AdminIpAllowlistGuard, PlatformAdminGuard, AdminPermissionGuard)
export class AdminFeedIngredientController {
  constructor(
    private readonly ingredients: FeedIngredientService,
    private readonly audit: AdminAuditService,
  ) {}

  @Get()
  @RequireAdminPermission('feed-ingredient.read')
  list() {
    return this.ingredients.listCatalogueForAdmin();
  }

  @Post()
  @RequireAdminPermission('feed-ingredient.manage')
  async create(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Body() dto: CreateCatalogueIngredientDto,
    @Req() req: Request,
  ) {
    const ingredient = await this.ingredients.createCatalogueIngredient(dto);
    await this.audit.record({
      adminId: admin.id,
      action: 'FEED_INGREDIENT_CREATED',
      entityType: 'FeedIngredient',
      entityId: ingredient.id,
      metadata: {
        name_en: ingredient.name_en,
        feed_class: ingredient.feed_class,
      },
      ipAddress: req.ip,
    });
    return ingredient;
  }

  @Patch(':id')
  @RequireAdminPermission('feed-ingredient.manage')
  async update(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: UpdateCatalogueIngredientDto,
    @Req() req: Request,
  ) {
    const ingredient = await this.ingredients.updateCatalogueIngredient(
      id,
      dto,
    );
    await this.audit.record({
      adminId: admin.id,
      action: 'FEED_INGREDIENT_UPDATED',
      entityType: 'FeedIngredient',
      entityId: ingredient.id,
      metadata: { fields: Object.keys(dto) },
      ipAddress: req.ip,
    });
    return ingredient;
  }

  @Delete(':id')
  @RequireAdminPermission('feed-ingredient.manage')
  async archive(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ingredient = await this.ingredients.setCatalogueIngredientActive(
      id,
      false,
    );
    await this.audit.record({
      adminId: admin.id,
      action: 'FEED_INGREDIENT_ARCHIVED',
      entityType: 'FeedIngredient',
      entityId: ingredient.id,
      ipAddress: req.ip,
    });
    return ingredient;
  }

  @Post(':id/restore')
  @RequireAdminPermission('feed-ingredient.manage')
  async restore(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const ingredient = await this.ingredients.setCatalogueIngredientActive(
      id,
      true,
    );
    await this.audit.record({
      adminId: admin.id,
      action: 'FEED_INGREDIENT_RESTORED',
      entityType: 'FeedIngredient',
      entityId: ingredient.id,
      ipAddress: req.ip,
    });
    return ingredient;
  }
}
