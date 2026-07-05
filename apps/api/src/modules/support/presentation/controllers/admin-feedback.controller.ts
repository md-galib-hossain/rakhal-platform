import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from 'src/modules/admin/presentation/guards/platform-admin.guard';
import { CurrentAdmin } from 'src/modules/admin/presentation/decorators/current-admin.decorator';
import type { CurrentAdminContext } from 'src/modules/admin/domain/authenticated-admin-request.type';
import { FeedbackService } from '../../application/services/feedback.service';
import { ListFeedbackQueryDto } from '../dto/list-feedback-query.dto';
import { UpdateFeedbackDto } from '../dto/update-feedback.dto';

/**
 * Support triage inbox (RAKHAL-242, PRD §36.7). `/api/v1/admin/feedback` —
 * `admin-api`, behind `PlatformAdminGuard` (a farm token can't reach it). The
 * Rakhal team lists + triages feedback across all farms.
 */
@ApiTags('Admin — Support')
@ApiBearerAuth()
@Controller('admin/feedback')
@UseGuards(PlatformAdminGuard)
export class AdminFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  list(@Query() query: ListFeedbackQueryDto) {
    return this.feedback.listForAdmin(query.status);
  }

  @Patch(':id')
  update(
    @CurrentAdmin() admin: CurrentAdminContext,
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackDto,
  ) {
    return this.feedback.updateStatus(id, admin.id, dto);
  }
}
