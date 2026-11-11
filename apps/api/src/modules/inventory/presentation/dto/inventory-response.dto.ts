import { ApiProperty } from '@nestjs/swagger';
import {
  EquipmentType,
  MedicineCategory,
  MedicineType,
  MilkTankActivity,
  MilkTankType,
  SemenType,
  TargetSex,
  UnitDimension,
} from '@prisma/client';
import type { CursorPage } from 'src/common/pagination/cursor-page.type';
import type { MediaUrls } from 'src/modules/media/application/services/media.service';
import type { EquipmentService } from '../../application/services/equipment.service';
import type { MedicineService } from '../../application/services/medicine.service';
import type { MilkTankService } from '../../application/services/milk-tank.service';
import type { SemenService } from '../../application/services/semen.service';
import type { UnitService } from '../../application/services/unit.service';
import type { ExpiryStatus, StockStatus } from '../../domain/medicine-status';

/**
 * Documented response shapes for the inventory routes typed under RD-140 (equipment, medicine, milk tank,
 * semen, unit). Each class mirrors what the service really returns and is pinned to it by a compile-time
 * guard at the bottom of this file, so a change in a service (or a Prisma column) fails `nest build` until
 * this file follows. `Date` fields are ISO-8601 strings on the wire; quantities and costs are `Float`
 * columns, so they are plain JSON numbers.
 *
 * Not covered yet: the feed-item routes (large nutrition/batch shapes), tracked in RD-140.
 */

const DATE_TIME = { type: String, format: 'date-time' } as const;
const STOCK_STATUS = ['out', 'low', 'adequate'] as const;
const EXPIRY_STATUS = ['expired', 'expiring_soon', 'ok'] as const;

// ─── Shared ────────────────────────────────────────────────────────────────

export class BulkDeleteResponseDto {
  @ApiProperty({ description: 'How many rows were archived.' })
  deleted!: number;
}

export class UnitResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() symbol!: string;
  @ApiProperty({ enum: UnitDimension, enumName: 'UnitDimension' })
  dimension!: UnitDimension;
  @ApiProperty({ type: Number, nullable: true })
  conversionToBase!: number | null;
  @ApiProperty() isSystemDefault!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty({ type: String, nullable: true }) farmId!: string | null;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
}

// ─── Equipment ─────────────────────────────────────────────────────────────

export class EquipmentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty({ type: String, nullable: true }) assetId!: string | null;
  @ApiProperty({ enum: EquipmentType, enumName: 'EquipmentType' })
  type!: EquipmentType;
  @ApiProperty({ type: String, nullable: true }) unitId!: string | null;
  @ApiProperty() currentStock!: number;
  @ApiProperty() costPerUnit!: number;
  @ApiProperty() lowStockThreshold!: number;
  @ApiProperty(DATE_TIME) purchaseDate!: Date;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({ type: () => UnitResponseDto, nullable: true })
  unit!: UnitResponseDto | null;
  @ApiProperty({ enum: STOCK_STATUS, enumName: 'StockStatus' })
  stockStatus!: StockStatus;
}

// ─── Medicine ──────────────────────────────────────────────────────────────

export class MedicineResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty({ type: String, nullable: true }) imageUrl!: string | null;
  @ApiProperty({ type: String, nullable: true }) photoAssetId!: string | null;
  @ApiProperty({ enum: MedicineType, enumName: 'MedicineType' })
  type!: MedicineType;
  @ApiProperty({ enum: MedicineCategory, enumName: 'MedicineCategory' })
  category!: MedicineCategory;
  @ApiProperty({ type: String, nullable: true }) manufacturer!: string | null;
  @ApiProperty({ type: String, nullable: true }) batchId!: string | null;
  @ApiProperty() unitId!: string;
  @ApiProperty() currentStock!: number;
  @ApiProperty() costPerUnit!: number;
  @ApiProperty() lowStockThreshold!: number;
  @ApiProperty(DATE_TIME) purchaseDate!: Date;
  @ApiProperty(DATE_TIME) expiryDate!: Date;
  @ApiProperty() milkWithdrawalDays!: number;
  @ApiProperty() meatWithdrawalDays!: number;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({ type: () => UnitResponseDto }) unit!: UnitResponseDto;
  @ApiProperty({ enum: STOCK_STATUS, enumName: 'StockStatus' })
  stockStatus!: StockStatus;
  @ApiProperty({ enum: EXPIRY_STATUS, enumName: 'ExpiryStatus' })
  expiryStatus!: ExpiryStatus;
}

/** `POST /inventory/medicines/:id/batches`: the medicine row, always with a batch id. */
export class MedicineBatchResponseDto extends MedicineResponseDto {
  @ApiProperty() declare batchId: string;
}

/** One row of `GET /inventory/medicines/by-batch-code`. */
export class MedicineBatchLookupDto {
  @ApiProperty() batchId!: string;
  @ApiProperty({ type: String, nullable: true }) batchCode!: string | null;
  @ApiProperty() medicineId!: string;
  @ApiProperty() medicineName!: string;
  @ApiProperty() currentStock!: number;
  @ApiProperty() costPerUnit!: number;
  @ApiProperty(DATE_TIME) purchaseDate!: Date;
  @ApiProperty(DATE_TIME) expiryDate!: Date;
  @ApiProperty({ description: 'Unit symbol.' }) unit!: string;
}

export class MediaUrlsDto {
  @ApiProperty() asset_id!: string;
  @ApiProperty() thumb_url!: string;
  @ApiProperty({ type: String, nullable: true }) full_url!: string | null;
  @ApiProperty({ type: Number, nullable: true }) width!: number | null;
  @ApiProperty({ type: Number, nullable: true }) height!: number | null;
  @ApiProperty() expires_at!: string;
}

export class RemovePhotoResponseDto {
  @ApiProperty() removed!: boolean;
}

// ─── Milk tank ─────────────────────────────────────────────────────────────

export class MilkTankResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty({ enum: MilkTankType, enumName: 'MilkTankType' })
  tankType!: MilkTankType;
  @ApiProperty() totalCapacityL!: number;
  @ApiProperty() currentVolumeL!: number;
  @ApiProperty({ type: Number, nullable: true }) fatPct!: number | null;
  @ApiProperty({ type: Number, nullable: true }) proteinPct!: number | null;
  @ApiProperty({ type: Number, nullable: true }) snfPct!: number | null;
  @ApiProperty({ type: String, nullable: true })
  smartSensorId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) targetTempC!: number | null;
  @ApiProperty({ type: Number, nullable: true })
  agitationIntervalMin!: number | null;
  @ApiProperty({ type: String, nullable: true })
  assignedShedId!: string | null;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty() fillPct!: number;
  @ApiProperty() isActive!: boolean;
}

export class MilkTankAuditEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty() milkTankId!: string;
  @ApiProperty({ enum: MilkTankActivity, enumName: 'MilkTankActivity' })
  activityType!: MilkTankActivity;
  @ApiProperty() quantityL!: number;
  @ApiProperty() balanceAfterL!: number;
  @ApiProperty({ type: String, nullable: true }) source!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ type: String, nullable: true }) saleLineId!: string | null;
}

// ─── Semen ─────────────────────────────────────────────────────────────────

export class SemenTankResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty({ type: String, nullable: true })
  modelManufacturer!: string | null;
  @ApiProperty() strawCapacity!: number;
  @ApiProperty({ type: Number, nullable: true }) numCanisters!: number | null;
  @ApiProperty({ type: Number, nullable: true }) numGoblets!: number | null;
  @ApiProperty({ type: String, nullable: true })
  storageLocation!: string | null;
  @ApiProperty({ type: Number, nullable: true }) currentTempC!: number | null;
  @ApiProperty({ type: Number, nullable: true }) ln2LevelPct!: number | null;
  @ApiProperty() strawInStock!: number;
  @ApiProperty() availableCapacity!: number;
}

export class SemenBatchResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() farmId!: string;
  @ApiProperty({ type: String, nullable: true }) batchCode!: string | null;
  @ApiProperty({ type: String, nullable: true }) bullId!: string | null;
  @ApiProperty({ type: String, nullable: true }) breed!: string | null;
  @ApiProperty({ type: String, nullable: true }) strawColor!: string | null;
  @ApiProperty({ type: Number, nullable: true })
  initialVitalityPct!: number | null;
  @ApiProperty() strawQuantity!: number;
  @ApiProperty() lowStrawThreshold!: number;
  @ApiProperty({ enum: SemenType, enumName: 'SemenType', nullable: true })
  semenType!: SemenType | null;
  @ApiProperty({ enum: TargetSex, enumName: 'TargetSex', nullable: true })
  targetSex!: TargetSex | null;
  @ApiProperty({ type: Number, nullable: true }) costPerUnit!: number | null;
  @ApiProperty({ type: String, nullable: true }) fatherId!: string | null;
  @ApiProperty({ type: String, nullable: true }) motherId!: string | null;
  @ApiProperty({ type: String, nullable: true }) tankId!: string | null;
  @ApiProperty({ type: String, nullable: true }) canister!: string | null;
  @ApiProperty({ type: String, nullable: true }) goblet!: string | null;
  @ApiProperty({ type: String, nullable: true }) notes!: string | null;
  @ApiProperty({ ...DATE_TIME, nullable: true }) deletedAt!: Date | null;
  @ApiProperty() createdBy!: string;
  @ApiProperty(DATE_TIME) createdAt!: Date;
  @ApiProperty(DATE_TIME) updatedAt!: Date;
  @ApiProperty() lowStraw!: boolean;
}

// ─── Compile-time guards (RD-140) ───────────────────────────────────────────
// Each fails `nest build` if the service's real return type and the documented class diverge.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type Ret<S, K extends keyof S> = S[K] extends (...args: never[]) => infer R
  ? Awaited<R>
  : never;

type Eq = EquipmentService;
type Med = MedicineService;
type Tank = MilkTankService;
type Sem = SemenService;

export type InventoryShapeGuards = [
  // unit
  Assert<Same<Ret<UnitService, 'findAll'>, UnitResponseDto[]>>,
  Assert<Same<Ret<UnitService, 'create'>, UnitResponseDto>>,
  Assert<Same<Ret<UnitService, 'archive'>, UnitResponseDto>>,
  // equipment
  Assert<Same<Ret<Eq, 'create'>, EquipmentResponseDto>>,
  Assert<Same<Ret<Eq, 'findOne'>, EquipmentResponseDto>>,
  Assert<Same<Ret<Eq, 'update'>, EquipmentResponseDto>>,
  Assert<Same<Ret<Eq, 'archive'>, EquipmentResponseDto>>,
  Assert<Same<Ret<Eq, 'restore'>, EquipmentResponseDto>>,
  Assert<Same<Ret<Eq, 'remove'>, EquipmentResponseDto>>,
  Assert<Same<Ret<Eq, 'findAll'>, CursorPage<EquipmentResponseDto>>>,
  Assert<Same<Ret<Eq, 'removeMany'>, BulkDeleteResponseDto>>,
  // medicine
  Assert<Same<Ret<Med, 'create'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'findOne'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'update'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'adjustStockManual'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'archive'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'restore'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'remove'>, MedicineResponseDto>>,
  Assert<Same<Ret<Med, 'createBatch'>, MedicineBatchResponseDto>>,
  Assert<Same<Ret<Med, 'findAll'>, CursorPage<MedicineResponseDto>>>,
  Assert<Same<Ret<Med, 'findByBatchCode'>, MedicineBatchLookupDto[]>>,
  Assert<Same<Ret<Med, 'getPhoto'>, MediaUrlsDto | null>>,
  Assert<Same<Ret<Med, 'setPhoto'>, MediaUrlsDto>>,
  Assert<Same<Ret<Med, 'removePhoto'>, RemovePhotoResponseDto>>,
  Assert<Same<Ret<Med, 'removeMany'>, BulkDeleteResponseDto>>,
  Assert<Same<MediaUrls, MediaUrlsDto>>,
  // milk tank
  Assert<Same<Ret<Tank, 'findAll'>, MilkTankResponseDto[]>>,
  Assert<Same<Ret<Tank, 'findOne'>, MilkTankResponseDto>>,
  Assert<Same<Ret<Tank, 'create'>, MilkTankResponseDto>>,
  Assert<Same<Ret<Tank, 'update'>, MilkTankResponseDto>>,
  Assert<Same<Ret<Tank, 'setPrimary'>, MilkTankResponseDto>>,
  Assert<Same<Ret<Tank, 'adjustVolumeManual'>, MilkTankResponseDto>>,
  Assert<Same<Ret<Tank, 'archive'>, MilkTankResponseDto>>,
  Assert<Same<Ret<Tank, 'auditLog'>, CursorPage<MilkTankAuditEntryDto>>>,
  // semen
  Assert<Same<Ret<Sem, 'listTanks'>, SemenTankResponseDto[]>>,
  Assert<Same<Ret<Sem, 'createTank'>, SemenTankResponseDto>>,
  Assert<Same<Ret<Sem, 'updateTank'>, SemenTankResponseDto>>,
  Assert<Same<Ret<Sem, 'archiveTank'>, SemenTankResponseDto>>,
  Assert<Same<Ret<Sem, 'listBatches'>, CursorPage<SemenBatchResponseDto>>>,
  Assert<Same<Ret<Sem, 'createBatch'>, SemenBatchResponseDto>>,
  Assert<Same<Ret<Sem, 'updateBatch'>, SemenBatchResponseDto>>,
  Assert<Same<Ret<Sem, 'archiveBatch'>, SemenBatchResponseDto>>,
];
