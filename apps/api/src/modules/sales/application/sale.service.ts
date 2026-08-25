import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Sale, SaleLineType, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  clampNonNegative,
  multiply,
  subtract,
  sum,
  toStorage,
} from 'src/common/money';
import { validateSaleLineDetailShape } from '../domain/sale-line-shape';
import { SaleNumberAllocator } from '../infrastructure/sale-number.allocator';
import { CreateSaleDto } from '../presentation/dto/create-sale.dto';
import { CreateSaleLineDto } from '../presentation/dto/create-sale-line.dto';

/** `Sale` with every line's typed detail eagerly loaded — the shape every read
 * route (and every future sale-type use case) works with. */
const SALE_INCLUDE = {
  lines: {
    include: {
      unit: true,
      milkDetail: true,
      animalDetail: true,
      inventoryDetail: true,
      manureDetail: true,
    },
  },
} satisfies Prisma.SaleInclude;

export type SaleWithLines = Prisma.SaleGetPayload<{
  include: typeof SALE_INCLUDE;
}>;

/**
 * Sales document engine (RAKHAL-339, Sales module — `FINANCE_V2_DESIGN.md` §4.3,
 * §5.1). **This ticket's scope is the document model + persistence + numbering
 * only** — `createSale` does NOT post journal entries, create a `Receivable`, or
 * decrement any stock. Those are RAKHAL-340 (Receivable v2) and the per-sale-type
 * use cases (RAKHAL-342 SellMilk / RAKHAL-345 SellAnimal / RAKHAL-346
 * SellInventoryItem / RAKHAL-347 RecordManureSale), which call `createSale` as the
 * first step of their own `$transaction` and continue with their own stock/ledger
 * side effects on the same client.
 *
 * `createSale(farmId, userId, dto, tx?)` follows the same `tx ?? this.prisma.
 * $transaction(...)` seam every other Finance V2 service uses (RAKHAL-335/337) so a
 * later use-case ticket can pass its own already-open transaction client straight
 * through and get one atomic unit covering Sale+SaleLine+typed-detail+its own
 * domain mutation.
 */
@Injectable()
export class SaleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly saleNumberAllocator: SaleNumberAllocator,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(SaleService.name);
  }

  async createSale(
    farmId: string,
    userId: string,
    dto: CreateSaleDto,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleWithLines> {
    const run = (client: Prisma.TransactionClient) =>
      this.createWithClient(client, farmId, userId, dto);
    return tx ? run(tx) : this.prisma.$transaction((t) => run(t));
  }

  private async createWithClient(
    client: Prisma.TransactionClient,
    farmId: string,
    userId: string,
    dto: CreateSaleDto,
  ): Promise<SaleWithLines> {
    for (const line of dto.lines) {
      const error = validateSaleLineDetailShape(line);
      if (error) {
        throw new BadRequestException(error);
      }
    }

    const lineComputations = dto.lines.map((line) => ({
      line,
      totalAmount: toStorage(multiply(line.quantity, line.unitPrice)),
    }));
    const subtotal = toStorage(sum(lineComputations.map((c) => c.totalAmount)));
    const discountAmount = toStorage(dto.discountAmount ?? 0);
    const totalAmount = clampNonNegative(subtract(subtotal, discountAmount));

    const saleNumber = await this.saleNumberAllocator.allocate(client, farmId);

    const sale = await client.sale.create({
      data: {
        farmId,
        saleNumber,
        customerId: dto.customerId ?? null,
        saleDate: new Date(dto.saleDate),
        subtotal,
        discountAmount,
        totalAmount,
        status: SaleStatus.DRAFT,
        notes: dto.notes ?? null,
        createdById: userId,
      },
    });

    for (const { line, totalAmount: lineTotal } of lineComputations) {
      const saleLine = await client.saleLine.create({
        data: {
          saleId: sale.id,
          type: line.type,
          description: line.description,
          quantity: toStorage(line.quantity),
          unitId: line.unitId ?? null,
          unitPrice: toStorage(line.unitPrice),
          totalAmount: lineTotal,
        },
      });
      await this.createLineDetail(client, farmId, saleLine.id, line);
    }

    this.log.info('Sale created', {
      farmId,
      saleId: sale.id,
      saleNumber,
      lineCount: dto.lines.length,
      totalAmount: totalAmount.toString(),
    });

    return this.getOrThrow(client, farmId, sale.id);
  }

  private async createLineDetail(
    client: Prisma.TransactionClient,
    farmId: string,
    saleLineId: string,
    line: CreateSaleLineDto,
  ): Promise<void> {
    switch (line.type) {
      case SaleLineType.MILK:
        await client.milkSaleLine.create({ data: { saleLineId } });
        return;

      case SaleLineType.ANIMAL: {
        const cattle = await client.cattle.findFirst({
          where: { id: line.cattleId, farmId },
          select: { id: true },
        });
        if (!cattle) {
          throw new NotFoundException('Cattle not found for ANIMAL sale line');
        }
        await client.animalSaleLine.create({
          data: { saleLineId, cattleId: cattle.id },
        });
        return;
      }

      case SaleLineType.INVENTORY: {
        if (line.medicineId) {
          const medicine = await client.medicine.findFirst({
            where: { id: line.medicineId, farmId },
            select: { id: true },
          });
          if (!medicine) {
            throw new NotFoundException(
              'Medicine not found for INVENTORY sale line',
            );
          }
        } else if (line.feedItemId) {
          const feedItem = await client.feedItem.findFirst({
            where: { id: line.feedItemId, farmId },
            select: { id: true },
          });
          if (!feedItem) {
            throw new NotFoundException(
              'Feed item not found for INVENTORY sale line',
            );
          }
        } else if (line.equipmentId) {
          const equipment = await client.equipment.findFirst({
            where: { id: line.equipmentId, farmId },
            select: { id: true },
          });
          if (!equipment) {
            throw new NotFoundException(
              'Equipment not found for INVENTORY sale line',
            );
          }
        }
        await client.inventorySaleLine.create({
          data: {
            saleLineId,
            medicineId: line.medicineId ?? null,
            feedItemId: line.feedItemId ?? null,
            equipmentId: line.equipmentId ?? null,
          },
        });
        return;
      }

      case SaleLineType.MANURE:
        await client.manureSaleLine.create({
          data: { saleLineId, notes: line.manureNotes ?? null },
        });
    }
  }

  async findOne(farmId: string, id: string): Promise<SaleWithLines> {
    return this.getOrThrow(this.prisma, farmId, id);
  }

  async findAll(farmId: string): Promise<Sale[]> {
    return this.prisma.sale.findMany({
      where: { farmId },
      orderBy: [{ saleDate: 'desc' }, { id: 'desc' }],
    });
  }

  private async getOrThrow(
    client: Prisma.TransactionClient | PrismaService,
    farmId: string,
    id: string,
  ): Promise<SaleWithLines> {
    const sale = await client.sale.findFirst({
      where: { id, farmId },
      include: SALE_INCLUDE,
    });
    if (!sale) {
      throw new NotFoundException('Sale not found');
    }
    return sale;
  }
}
