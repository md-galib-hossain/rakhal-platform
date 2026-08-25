import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { ExpenseCategory } from '@prisma/client';
import { trimString } from 'src/common/dto';

/**
 * `POST /purchasing/expenses` (RAKHAL-348, `FINANCE_V2_DESIGN.md` §5.1).
 * Tenant (`farmId`) comes from the access token via `FarmContextGuard` —
 * never accepted in the body.
 *
 * **Simpler payment shape than `CreatePurchaseDto`** — an expense is either
 * paid in full immediately (`financialAccountId` set) or raised in full as a
 * `Payable` (`financialAccountId` omitted). The ticket's own AC text lists
 * only `financialAccountId?` on the `Expense` model itself, with no
 * "paidAmount" partial-payment field — unlike `Purchase`'s explicit
 * ৳30,000/৳20,000 partial worked example, no partial-expense example is
 * specced, so this DTO doesn't invent one.
 */
export class RecordExpenseDto {
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  /** Set to pay this expense in full immediately from this account. Omit to
   * raise the full amount as a `Payable` instead. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  financialAccountId?: string;

  /** Optional due date for the `Payable` raised when the expense isn't paid
   * at creation. */
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  notes?: string;

  /** RAKHAL-354: which animal this expense is attributable to, if any — see
   * `Expense.cattleId`'s own doc comment (`prisma/schemas/purchasing/
   * purchase.prisma`). Not part of this ticket's own AC; added so
   * `ReproductionService`'s migrated breeding-cost posting can reuse this
   * real production DTO/service instead of a parallel hand-rolled journal
   * posting. */
  @IsOptional()
  @Transform(trimString)
  @IsString()
  cattleId?: string;
}
