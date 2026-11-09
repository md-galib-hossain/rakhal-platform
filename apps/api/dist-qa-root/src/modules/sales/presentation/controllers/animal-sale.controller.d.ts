import { SellAnimalUseCase } from '../../application/use-cases/sell-animal/sell-animal.use-case';
import { SellAnimalDto } from '../dto/sell-animal.dto';
export declare class AnimalSaleController {
    private readonly sellAnimal;
    constructor(sellAnimal: SellAnimalUseCase);
    sell(farmId: string, userId: string, cattleId: string, dto: SellAnimalDto): Promise<import("../../application/use-cases/sell-animal/sell-animal.types").SellAnimalResult>;
}
