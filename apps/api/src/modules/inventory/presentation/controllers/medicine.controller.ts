import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { env } from 'src/core/config/env';
import { CurrentFarmId, CurrentUserId } from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { PermissionGuard } from 'src/modules/permission/presentation/guards/permission.guard';
import { SubscriptionGuard } from 'src/modules/subscription/presentation/guards/subscription.guard';
import { RequirePermission } from 'src/modules/permission/presentation/decorators/require-permission.decorator';
import { MedicineService } from '../../application/services/medicine.service';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { CreateMedicineDto } from '../dto/create-medicine.dto';
import { ListMedicineQueryDto } from '../dto/list-medicine-query.dto';
import { UpdateMedicineDto } from '../dto/update-medicine.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

/** Max product-photo upload size — same limit as the cattle profile-photo endpoint. */
const PHOTO_MAX_BYTES = env.MEDIA_MAX_UPLOAD_BYTES;

/**
 * Inventory â†’ Medicine tab. Routes resolve under the global prefix as
 * `/api/v1/inventory/medicines`.
 *
 * Guard chain (token-based tenancy + RBAC â€” see TEMPLATE_OVERVIEW Â§6):
 *   JwtAuthGuard â†’ SessionGuard â†’ FarmContextGuard â†’ PermissionGuard
 * The active farm is taken from the verified token context, never the body.
 */
@ApiTags('Inventory')
@ApiBearerAuth()
@Controller('inventory/medicines')
@UseGuards(
  JwtAuthGuard,
  SessionGuard,
  FarmContextGuard,
  PermissionGuard,
  SubscriptionGuard,
)
export class MedicineController {
  constructor(private readonly medicineService: MedicineService) {}

  @Post()
  @RequirePermission('inventory.create')
  create(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateMedicineDto,
  ) {
    return this.medicineService.create(farmId, userId, dto);
  }

  @Get()
  @RequirePermission('inventory.read')
  findAll(
    @CurrentFarmId() farmId: string,
    @Query() query: ListMedicineQueryDto,
  ) {
    return this.medicineService.findAll(farmId, query);
  }

  @Get(':id')
  @RequirePermission('inventory.read')
  findOne(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.medicineService.findOne(farmId, id);
  }

  @Patch(':id')
  @RequirePermission('inventory.update')
  update(
    @CurrentFarmId() farmId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMedicineDto,
  ) {
    return this.medicineService.update(farmId, id, dto);
  }

  @Post(':id/adjust-stock')
  @RequirePermission('inventory.update')
  adjustStock(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.medicineService.adjustStock(farmId, userId, id, dto);
  }

  @Get(':id/photo')
  @RequirePermission('inventory.read')
  getPhoto(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.medicineService.getPhoto(farmId, id);
  }

  @Post(':id/photo')
  @RequirePermission('inventory.update')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: PHOTO_MAX_BYTES } }),
  )
  setPhoto(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.medicineService.setPhoto(farmId, userId, id, file);
  }

  @Delete(':id/photo')
  @RequirePermission('inventory.update')
  removePhoto(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.medicineService.removePhoto(farmId, userId, id);
  }

  @Patch(':id/archive')
  @RequirePermission('inventory.update')
  archive(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.medicineService.archive(farmId, id);
  }

  @Patch(':id/restore')
  @RequirePermission('inventory.update')
  restore(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.medicineService.restore(farmId, id);
  }

  @Delete(':id')
  @RequirePermission('inventory.delete')
  remove(@CurrentFarmId() farmId: string, @Param('id') id: string) {
    return this.medicineService.remove(farmId, id);
  }
}
