import { Matches } from 'class-validator';

/** `GET /feed/grid/calendar` — per-day feeding-entry status (RAKHAL-434) for the missed-entry
 * calendar picker on the Feed Grid page. `month` is `YYYY-MM`. */
export class FeedGridCalendarQueryDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be in YYYY-MM format',
  })
  month!: string;
}
