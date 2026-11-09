import { SellInventoryUseCase } from '../../application/use-cases/sell-inventory/sell-inventory.use-case';
import { SellInventoryDto } from '../dto/sell-inventory.dto';
export declare class InventorySaleController {
    private readonly sellInventory;
    constructor(sellInventory: SellInventoryUseCase);
    sell(farmId: string, userId: string, dto: SellInventoryDto): Promise<import("../../application/use-cases/sell-inventory/sell-inventory.types").SellInventoryItemResult>;
}
