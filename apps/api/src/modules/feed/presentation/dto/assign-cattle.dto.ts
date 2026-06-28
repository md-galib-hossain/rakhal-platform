import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** `POST /feed/groups/:id/assign-cattle` — bulk-assign cattle to a feed group (RAKHAL-083, §12.2). */
export class AssignCattleDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  cattleIds!: string[];
}
