import { PartialType } from '@nestjs/swagger';
import { CreateNotificationScheduleDto } from './create-notification-schedule.dto';

/** `PATCH /notifications/schedules/:id`: any subset of the create body; omitted fields keep their value. */
export class UpdateNotificationScheduleDto extends PartialType(
  CreateNotificationScheduleDto,
) {}
