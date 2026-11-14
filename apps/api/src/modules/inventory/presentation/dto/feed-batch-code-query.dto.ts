import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { trimString } from 'src/common/dto';

/** `GET /inventory/feed-items/by-batch-code?code=LOT-4471` — recall lookup (RAKHAL-444). */
export class FeedBatchCodeQueryDto {
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  code!: string;
}
