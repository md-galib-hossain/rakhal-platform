import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { trimString } from 'src/common/dto';

/** `POST /feed/grid/distributions/:distributionId/cattle/:cattleItemId/void` (RAKHAL-441) — voids
 * exactly one cow's line from a confirmed Feeding Grid distribution: credits back the stock it
 * drew, shrinks the sibling `FeedDistributionItem`/parent `FeedDistribution` totals by that cow's
 * exact contribution, and excludes it from `expense_breakdown.feed`. Never deletes the row. */
export class VoidFeedCattleItemDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  reason?: string;
}
