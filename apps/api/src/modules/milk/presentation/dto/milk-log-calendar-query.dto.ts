import { Matches } from 'class-validator';

/** `GET /milk/log/calendar` — per-day entry status (RAKHAL-434) for the missed-entry calendar
 * picker on the Milk Log page. `month` is `YYYY-MM`; a full validator (not `@IsDateString`,
 * which expects a full date) since only year+month are meaningful here. */
export class MilkLogCalendarQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month!: string;
}
