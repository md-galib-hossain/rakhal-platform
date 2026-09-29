import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  DEFAULT_FARM_TIMEZONE,
  dayKey,
  localDateIso,
  localDayStart,
} from './farm-time';

/**
 * "Today" for a farm, in the farm's own timezone (`Farm.timezone`). Inject this wherever a request may omit a date
 * instead of reaching for `new Date().toISOString()` — that is the UTC day, one day behind a UTC+6 farm until 6 AM.
 * An explicit `YYYY-MM-DD` from the client is always honoured as-is.
 */
@Injectable()
export class FarmClockService {
  constructor(private readonly prisma: PrismaService) {}

  async timezone(farmId: string): Promise<string> {
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: { timezone: true },
    });
    return farm?.timezone ?? DEFAULT_FARM_TIMEZONE;
  }

  /** `YYYY-MM-DD` — today on the farm. */
  async todayIso(farmId: string): Promise<string> {
    return localDateIso(await this.timezone(farmId));
  }

  /** Storage key (UTC midnight) of today on the farm. */
  async todayStart(farmId: string): Promise<Date> {
    return localDayStart(await this.timezone(farmId));
  }

  /** Storage key of `dateStr` when given, otherwise of today on the farm. */
  async dayStart(farmId: string, dateStr?: string | null): Promise<Date> {
    return dateStr ? dayKey(dateStr) : this.todayStart(farmId);
  }
}
