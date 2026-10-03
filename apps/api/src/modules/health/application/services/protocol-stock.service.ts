import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { HealthActionType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  convertQuantity,
  UnitLike,
  unitsCompatible,
} from 'src/modules/inventory/domain/unit-conversion';

export const PROTOCOL_OUT_OF_STOCK = 'PROTOCOL_OUT_OF_STOCK';

export interface StockShortfall {
  medicineId: string | null;
  medicineName: string;
  needed: number;
  available: number;
  unit: string;
}

interface StepLike {
  actionType: HealthActionType;
  medicineId?: string | null;
  medicineName?: string | null;
  doseAmount?: unknown;
  doseUnitId?: string | null;
}

const toUnitLike = (u: {
  id: string;
  symbol: string;
  dimension: UnitLike['dimension'];
  conversionToBase: number | null;
}): UnitLike => ({
  id: u.id,
  symbol: u.symbol,
  dimension: u.dimension,
  conversionToBase: u.conversionToBase,
});

/**
 * Protocols v2: (1) validate a protocol's medicine steps against the farm's inventory when it is
 * saved, and (2) check there is enough usable (non-expired) stock before it is applied.
 */
@Injectable()
export class ProtocolStockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every MEDICINE step must reference an inventory medicine with a positive dose in a unit that
   * converts to the medicine's own unit. Returns the steps with `medicineName` + `doseUnit`
   * (symbol) snapshotted from the catalog so display/legacy readers stay correct.
   */
  async validateAndNormalizeSteps<T extends StepLike>(
    farmId: string,
    steps: T[],
  ): Promise<T[]> {
    const medSteps = steps.filter(
      (s) => s.actionType === HealthActionType.MEDICINE,
    );
    if (medSteps.length === 0) return steps;

    for (const [i, s] of medSteps.entries()) {
      if (!s.medicineId) {
        throw new BadRequestException(
          `Medicine step ${i + 1}: pick a medicine from inventory`,
        );
      }
      if (!(Number(s.doseAmount) > 0)) {
        throw new BadRequestException(
          `Medicine step ${i + 1}: dose must be greater than 0`,
        );
      }
      if (!s.doseUnitId) {
        throw new BadRequestException(
          `Medicine step ${i + 1}: pick a dose unit`,
        );
      }
    }

    const medicines = await this.prisma.medicine.findMany({
      where: {
        farmId,
        deletedAt: null,
        id: { in: [...new Set(medSteps.map((s) => s.medicineId!))] },
      },
      include: { unit: true },
    });
    const medById = new Map(medicines.map((m) => [m.id, m]));
    const doseUnits = await this.prisma.unit.findMany({
      where: {
        deletedAt: null,
        id: { in: [...new Set(medSteps.map((s) => s.doseUnitId!))] },
        OR: [{ farmId: null }, { farmId }],
      },
    });
    const unitById = new Map(doseUnits.map((u) => [u.id, u]));

    return steps.map((s) => {
      if (s.actionType !== HealthActionType.MEDICINE) return s;
      const med = medById.get(s.medicineId!);
      if (!med) {
        throw new BadRequestException(
          `Medicine "${s.medicineName ?? s.medicineId}" was not found in inventory`,
        );
      }
      const doseUnit = unitById.get(s.doseUnitId!);
      if (!doseUnit) {
        throw new BadRequestException(
          `Dose unit for "${med.name}" was not found`,
        );
      }
      if (!unitsCompatible(toUnitLike(doseUnit), toUnitLike(med.unit))) {
        throw new BadRequestException(
          `Dose unit ${doseUnit.symbol} cannot be converted to ${med.name}'s stock unit ${med.unit.symbol}`,
        );
      }
      return { ...s, medicineName: med.name, doseUnit: doseUnit.symbol };
    });
  }

  /** Shortfalls for applying `steps` to `animalCount` animals; empty = enough stock. */
  async check(
    farmId: string,
    steps: StepLike[],
    animalCount: number,
  ): Promise<StockShortfall[]> {
    const medSteps = steps.filter(
      (s) =>
        s.actionType === HealthActionType.MEDICINE &&
        (s.medicineId || s.medicineName),
    );
    if (medSteps.length === 0 || animalCount <= 0) return [];

    const ids = [
      ...new Set(medSteps.map((s) => s.medicineId).filter(Boolean)),
    ] as string[];
    const names = [
      ...new Set(
        medSteps
          .filter((s) => !s.medicineId && s.medicineName)
          .map((s) => s.medicineName!.toLowerCase()),
      ),
    ];
    const medicines = await this.prisma.medicine.findMany({
      where: {
        farmId,
        deletedAt: null,
        OR: [
          ...(ids.length ? [{ id: { in: ids } }] : []),
          ...names.map((n) => ({
            name: { equals: n, mode: 'insensitive' as const },
          })),
        ],
      },
      include: {
        unit: true,
        // All live batches: a legacy medicine with none yet falls back to its own mirror fields
        // below (MedicineService heals those lazily on first consumption).
        batches: {
          where: { deletedAt: null },
          select: { currentStock: true, expiryDate: true },
        },
      },
    });
    const doseUnitIds = [
      ...new Set(medSteps.map((s) => s.doseUnitId).filter(Boolean)),
    ] as string[];
    const doseUnits = doseUnitIds.length
      ? await this.prisma.unit.findMany({ where: { id: { in: doseUnitIds } } })
      : [];
    const unitById = new Map(doseUnits.map((u) => [u.id, u]));

    // Group catalog rows so a name-only step sums every same-named row, like the decrement does.
    const need = new Map<
      string,
      { medicineIds: string[]; name: string; needed: number; unit: string }
    >();
    for (const s of medSteps) {
      const rows = s.medicineId
        ? medicines.filter((m) => m.id === s.medicineId)
        : medicines.filter(
            (m) => m.name.toLowerCase() === s.medicineName!.toLowerCase(),
          );
      const key = s.medicineId ?? `name:${s.medicineName!.toLowerCase()}`;
      const medUnit = rows[0] ? toUnitLike(rows[0].unit) : null;
      const doseU = s.doseUnitId ? unitById.get(s.doseUnitId) : undefined;
      let perAnimal = Number(s.doseAmount ?? 0);
      if (medUnit && doseU) {
        try {
          perAnimal = convertQuantity(perAnimal, toUnitLike(doseU), medUnit);
        } catch {
          // incompatible legacy row: keep the raw number, it is the best estimate we have
        }
      }
      const entry = need.get(key) ?? {
        medicineIds: rows.map((m) => m.id),
        name: rows[0]?.name ?? s.medicineName ?? 'Unknown medicine',
        needed: 0,
        unit: rows[0]?.unit.symbol ?? doseU?.symbol ?? '',
      };
      entry.needed += perAnimal * animalCount;
      need.set(key, entry);
    }

    const shortfalls: StockShortfall[] = [];
    for (const [key, n] of need) {
      const rows = medicines.filter((m) => n.medicineIds.includes(m.id));
      const now = new Date();
      const available = rows.reduce((sum, m) => {
        if (m.batches.length === 0) {
          return m.expiryDate > now ? sum + m.currentStock : sum;
        }
        return (
          sum +
          m.batches.reduce(
            (b, x) =>
              x.expiryDate > now ? b + Math.max(0, x.currentStock) : b,
            0,
          )
        );
      }, 0);
      // Zero usable stock is out of stock even when the dose is unknown/0.
      if (available <= 0 || n.needed > available + 1e-9) {
        shortfalls.push({
          medicineId: key.startsWith('name:') ? null : key,
          medicineName: n.name,
          needed: Math.round(n.needed * 1e6) / 1e6,
          available: Math.round(available * 1e6) / 1e6,
          unit: n.unit,
        });
      }
    }
    return shortfalls;
  }

  /** Throws 409 `PROTOCOL_OUT_OF_STOCK` (with the shortfall list) when stock is short. */
  async assertInStock(
    farmId: string,
    steps: StepLike[],
    animalCount: number,
  ): Promise<void> {
    const shortfalls = await this.check(farmId, steps, animalCount);
    if (shortfalls.length === 0) return;
    throw new ConflictException({
      // `details` (4xx only) is what the global filter forwards; `reason` is the machine-readable code.
      details: { reason: PROTOCOL_OUT_OF_STOCK, shortfalls },
      message: `Not enough stock: ${shortfalls
        .map(
          (s) =>
            `${s.medicineName} (need ${s.needed} ${s.unit}, have ${s.available} ${s.unit})`,
        )
        .join('; ')}`,
    });
  }
}
