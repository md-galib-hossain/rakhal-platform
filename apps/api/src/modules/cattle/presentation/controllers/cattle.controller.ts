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
import { CattleService } from '../../application/services/cattle.service';
import { AncestryQueryDto } from '../dto/ancestry-query.dto';
import { CreateCattleDto } from '../dto/create-cattle.dto';
import { ListCattleQueryDto } from '../dto/list-cattle-query.dto';
import { UpdateCattleDto } from '../dto/update-cattle.dto';

@Controller('cattle')
@UseGuards(JwtAuthGuard, SessionGuard)
export class CattleController {
  constructor(private readonly cattleService: CattleService) {}

  @Post()
  create(@Body() dto: CreateCattleDto, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.create(this.userId(request), dto);
  }

  @Get()
  findAll(
    @Query() query: ListCattleQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.cattleService.findAll(this.userId(request), query);
  }

  @Get(':id/profile')
  profile(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.profile(this.userId(request), id);
  }

  @Get(':id/ancestry')
  ancestry(
    @Param('id') id: string,
    @Query() query: AncestryQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ): Promise<unknown> {
    return this.cattleService.ancestry(this.userId(request), id, query);
  }

  @Get(':id/children')
  children(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.children(this.userId(request), id);
  }

  @Get(':id/siblings')
  siblings(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.siblings(this.userId(request), id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.findOne(this.userId(request), id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCattleDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.cattleService.update(this.userId(request), id, dto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.archive(this.userId(request), id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.restore(this.userId(request), id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.cattleService.remove(this.userId(request), id);
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    return userId;
  }
}
