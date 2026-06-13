import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { ReproductionService } from '../../application/services/reproduction.service';
import { ReproductionListQueryDto } from '../dto/common.dto';
import { CreateAbortionEventDto } from '../dto/create-abortion-event.dto';
import { CreateBreedingEventDto } from '../dto/create-breeding-event.dto';
import { CreateCalvingEventDto } from '../dto/create-calving-event.dto';
import { CreateHeatEventDto } from '../dto/create-heat-event.dto';
import { CreatePregnancyDiagnosisDto } from '../dto/create-pregnancy-diagnosis.dto';

@Controller('reproduction')
@UseGuards(JwtAuthGuard, SessionGuard)
export class ReproductionController {
  constructor(private readonly reproductionService: ReproductionService) {}

  @Post('heat-events')
  createHeatEvent(
    @Body() dto: CreateHeatEventDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.createHeatEvent(this.userId(request), dto);
  }

  @Get('heat-events')
  listHeatEvents(
    @Query() query: ReproductionListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.listHeatEvents(this.userId(request), query);
  }

  @Post('breeding-events')
  createBreedingEvent(
    @Body() dto: CreateBreedingEventDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.createBreedingEvent(
      this.userId(request),
      dto,
    );
  }

  @Get('breeding-events')
  listBreedingEvents(
    @Query() query: ReproductionListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.listBreedingEvents(
      this.userId(request),
      query,
    );
  }

  @Get('breeding-events/:id')
  getBreedingEvent(
    @Param('id') id: string,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.getBreedingEvent(this.userId(request), id);
  }

  @Post('pregnancy-diagnoses')
  createPregnancyDiagnosis(
    @Body() dto: CreatePregnancyDiagnosisDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.createPregnancyDiagnosis(
      this.userId(request),
      dto,
    );
  }

  @Get('pregnancies')
  listPregnancies(
    @Query() query: ReproductionListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.listPregnancies(this.userId(request), query);
  }

  @Post('calving-events')
  createCalvingEvent(
    @Body() dto: CreateCalvingEventDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.createCalvingEvent(
      this.userId(request),
      dto,
    );
  }

  @Get('calving-events')
  listCalvingEvents(
    @Query() query: ReproductionListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.listCalvingEvents(
      this.userId(request),
      query,
    );
  }

  @Post('abortion-events')
  createAbortionEvent(
    @Body() dto: CreateAbortionEventDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.createAbortionEvent(
      this.userId(request),
      dto,
    );
  }

  @Get('abortion-events')
  listAbortionEvents(
    @Query() query: ReproductionListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.listAbortionEvents(
      this.userId(request),
      query,
    );
  }

  @Get('lactations')
  listLactations(
    @Query() query: ReproductionListQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.reproductionService.listLactations(this.userId(request), query);
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    return userId;
  }
}
