import { Module } from '@nestjs/common';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { TenantAccessModule } from '../tenant-access/tenant-access.module';
import { PermissionModule } from '../permission/permission.module';
import { MedicineService } from './application/services/medicine.service';
import { ForageService } from './application/services/forage.service';
import { SemenService } from './application/services/semen.service';
import { MilkTankService } from './application/services/milk-tank.service';
import { MedicineController } from './presentation/controllers/medicine.controller';
import { ForageController } from './presentation/controllers/forage.controller';
import { SemenController } from './presentation/controllers/semen.controller';
import { MilkTankController } from './presentation/controllers/milk-tank.controller';

/**
 * Inventory module (PRD §15). Tabs: Medicine (RAKHAL-074), Forage (075),
 * Semen tanks + batches (077), Milk tanks + audit log (078). Equipment tab (076)
 * is the remaining MVP piece.
 *
 * Services are exported so cross-module integrations can consume them:
 *  - `SemenService.decrementStraw` ← Reproduction AI (REP-05)
 *  - `MilkTankService.adjustVolume` ← Milk submit (COLLECTION) / Finance sale (SALE)
 *  - `MedicineService` ← Healthcare treatment decrement (HLT-07)
 *
 * Imports AuthModule + TenantAccessModule so the controllers'
 * JwtAuthGuard / SessionGuard / FarmContextGuard resolve.
 */
@Module({
  imports: [AuthModule, TenantAccessModule, PermissionModule, LoggerModule],
  controllers: [
    MedicineController,
    ForageController,
    SemenController,
    MilkTankController,
  ],
  providers: [MedicineService, ForageService, SemenService, MilkTankService],
  exports: [MedicineService, ForageService, SemenService, MilkTankService],
})
export class InventoryModule {}
