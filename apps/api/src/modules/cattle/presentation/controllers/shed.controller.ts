import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedHttpRequest } from 'src/modules/auth/domain/authenticated-http-request.type';
import { JwtAuthGuard } from 'src/modules/auth/presentation/guards/jwt-auth.guard';
import { SessionGuard } from 'src/modules/auth/presentation/guards/session.guard';
import { ShedService } from '../../application/services/shed.service';
import { CreateShedDto } from '../dto/create-shed.dto';
import { ListShedQueryDto } from '../dto/list-shed-query.dto';
import { UpdateShedDto } from '../dto/update-shed.dto';

@Controller('sheds')
@UseGuards(JwtAuthGuard, SessionGuard)
export class ShedController {
  constructor(private readonly shedService: ShedService) {}

  @Post()
  create(@Body() dto: CreateShedDto, @Req() request: AuthenticatedHttpRequest) {
    return this.shedService.create(this.userId(request), dto);
  }

  @Get()
  findAll(
    @Query() query: ListShedQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.shedService.findAll(this.userId(request), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.shedService.findOne(this.userId(request), id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateShedDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.shedService.update(this.userId(request), id, dto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.shedService.archive(this.userId(request), id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.shedService.restore(this.userId(request), id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.shedService.remove(this.userId(request), id);
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    return userId;
  }
}
