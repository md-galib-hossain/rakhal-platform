import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { env } from 'src/core/config/env';
import {
  CurrentFarmId,
  CurrentUserId,
  ThrottleUpload,
} from 'src/common/decorators';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { FarmContextGuard } from 'src/modules/tenant-access/presentation/guards/farm-context.guard';
import { FeedbackService } from '../../application/services/feedback.service';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';

/**
 * Support feedback (RAKHAL-242, PRD §36.7). `/api/v1/feedback` — `customer-api`.
 * Any authenticated farm member can submit (no extra permission gate); the farm
 * chain scopes it to the caller's active farm. Multipart: `category` + `message`
 * form fields + an optional `file` screenshot.
 */
@ApiTags('Support')
@ApiBearerAuth()
@Controller('feedback')
@UseGuards(JwtAuthGuard, SessionGuard, FarmContextGuard)
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Post()
  @ThrottleUpload()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: env.MEDIA_MAX_UPLOAD_BYTES },
    }),
  )
  submit(
    @CurrentFarmId() farmId: string,
    @CurrentUserId() userId: string,
    @Body() dto: CreateFeedbackDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.feedback.submit(farmId, userId, dto, file);
  }
}
