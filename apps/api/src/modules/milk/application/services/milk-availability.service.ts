import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MilkTankType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

export interface MilkTankAvailability {
  tankId: string;
  tankName: string;
  /** Litres available to sell right now (see the class doc for why this is
   * just `MilkTank.currentVolumeL`, not a re-derived aggregate). */
  availableL: number;
  totalCapacityL: number;
}

export interface MilkAvailabilityResult {
  tanks: MilkTankAvailability[];
  totalAvailableL: number;
}

/**
 * RAKHAL-343 (Finance V2 — `FINANCE_V2_DESIGN.md` §9, PRD §10.4). Read model
 * + row-lock seam for "how much milk can this farm sell right now."
 *
 * **Why `getAvailability` is just `MilkTank.currentVolumeL`, not a fresh
 * produced-minus-consumed aggregate**: `MilkTankService.adjustVolume`
 * (`src/modules/inventory/application/services/milk-tank.service.ts`) is
 * already the single write path for every volume-changing event on a
 * SELLABLE tank — COLLECTION (a submitted milk log's litres flow in),
 * SALE (a confirmed sale flows out via `SellMilkUseCase`), and manual
 * ADJUSTMENT. `MilkService.submit` computes each log entry's
 * `MilkDisposition` (SALEABLE vs WITHHELD/COLOSTRUM/CALF_FEED/DISCARDED/
 * HOUSEHOLD_USE — see `prisma/schemas/milk/milk.enums.prisma`) *before* ever
 * calling `adjustVolume`, so non-saleable milk never reaches a SELLABLE tank
 * in the first place. `currentVolumeL` is therefore already "produced minus
 * calf-feed minus discarded minus withheld/colostrum/household minus
 * already-sold" by construction — recomputing that from raw `MilkLogEntry`
 * rows here would create a second, divergence-prone source of truth for the
 * exact number the tank row already holds authoritatively. The real work of
 * this ticket, per its own scoping note in `sell-milk.use-case.ts`'s class
 * doc, is `lockAndValidate`'s row lock — not a new aggregate.
 */
@Injectable()
export class MilkAvailabilityService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(MilkAvailabilityService.name);
  }

  /**
   * Available-to-sell volume per active SELLABLE tank (or just the one named
   * by `tankId`, if given). This is a point-in-time snapshot for display —
   * unlocked, and not itself a guarantee the volume is still there by the
   * time a caller tries to spend it. A caller about to decrement a tank must
   * use `lockAndValidate` instead, inside its own transaction.
   */
  async getAvailability(
    farmId: string,
    tankId?: string,
  ): Promise<MilkAvailabilityResult> {
    if (tankId) {
      const tank = await this.prisma.milkTank.findFirst({
        where: { id: tankId, farmId, tankType: MilkTankType.SELLABLE },
        select: {
          id: true,
          name: true,
          currentVolumeL: true,
          totalCapacityL: true,
        },
      });
      if (!tank) {
        throw new NotFoundException('Sellable milk tank not found');
      }
      return this.present([tank]);
    }

    const tanks = await this.prisma.milkTank.findMany({
      where: { farmId, tankType: MilkTankType.SELLABLE, isActive: true },
      select: {
        id: true,
        name: true,
        currentVolumeL: true,
        totalCapacityL: true,
      },
      orderBy: { currentVolumeL: 'desc' },
    });
    return this.present(tanks);
  }

  /**
   * Takes a Postgres row lock (`SELECT ... FOR UPDATE`) on the target
   * `MilkTank` row **within the caller's own transaction** — pass the real
   * `tx` client, never `this.prisma` directly, or the lock is released the
   * instant this call returns and the transaction gains nothing from it.
   * Re-reads `currentVolumeL` under that lock and throws immediately if it
   * is short of `requiredVolumeL`.
   *
   * Must run *before* `MilkTankService.adjustVolume` in the same
   * transaction, against the same `tx` client, so the lock is held for the
   * whole transaction's duration: a second concurrent transaction targeting
   * the same tank blocks on its own `FOR UPDATE` until the first commits or
   * rolls back, then re-reads the post-decrement volume rather than a stale
   * snapshot taken before the first transaction wrote anything. This is the
   * fix for the exact race a plain `findFirst` + application-computed
   * `balanceAfterL` (what `MilkTankService.adjustVolume` does on its own)
   * cannot prevent: two concurrent transactions can both read the same
   * `currentVolumeL`, both pass their own negative-balance check, and the
   * second `UPDATE` — which blocks on Postgres's implicit row lock during
   * the write, not before it — lands using a value computed from a stale
   * read, silently clobbering the first transaction's decrement (a lost
   * update, not a rejection).
   *
   * Follows the only other row-lock precedent in this codebase —
   * `ReproductionService.lockCattleForUpdate`
   * (`src/modules/reproduction/application/services/reproduction.service.ts:2359-2366`)
   * — same `$queryRaw` + `Prisma.sql` + `FOR UPDATE` shape.
   */
  async lockAndValidate(
    farmId: string,
    tankId: string,
    requiredVolumeL: number,
    tx: Prisma.TransactionClient,
  ): Promise<{ id: string; currentVolumeL: number }> {
    const rows = await tx.$queryRaw<{ id: string; currentVolumeL: number }[]>(
      Prisma.sql`SELECT "id", "currentVolumeL" FROM "MilkTank" WHERE "id" = ${tankId} AND "farmId" = ${farmId} FOR UPDATE`,
    );
    const tank = rows[0];
    if (!tank) {
      throw new NotFoundException('Milk tank not found');
    }
    if (tank.currentVolumeL < requiredVolumeL) {
      throw new BadRequestException(
        `Insufficient milk available: ${tank.currentVolumeL}L in tank, ${requiredVolumeL}L requested`,
      );
    }
    this.log.info('Milk tank locked for sale', {
      farmId,
      tankId,
      currentVolumeL: tank.currentVolumeL,
      requiredVolumeL,
    });
    return tank;
  }

  private present(
    tanks: Array<{
      id: string;
      name: string;
      currentVolumeL: number;
      totalCapacityL: number;
    }>,
  ): MilkAvailabilityResult {
    const presented = tanks.map((t) => ({
      tankId: t.id,
      tankName: t.name,
      availableL: t.currentVolumeL,
      totalCapacityL: t.totalCapacityL,
    }));
    return {
      tanks: presented,
      totalAvailableL: presented.reduce((sum, t) => sum + t.availableL, 0),
    };
  }
}
