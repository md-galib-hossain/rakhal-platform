import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { trimString } from 'src/common/dto';

/**
 * `POST /finance/income/categories` (RAKHAL-350, `FINANCE_V2_DESIGN.md`
 * §1.3, §5.1). Tenant (`farmId`) comes from the access token via
 * `FarmContextGuard` — never accepted in the body. Always creates a
 * farm-custom `IncomeCategory` (`isSystem: false`) — a farm can never create
 * a system row, mirroring `Unit`'s own custom-unit quick-add.
 */
export class CreateIncomeCategoryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  name!: string;
}
