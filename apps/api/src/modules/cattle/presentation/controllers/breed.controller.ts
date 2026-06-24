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
import { BreedService } from '../../application/services/breed.service';
import { CreateBreedDto } from '../dto/create-breed.dto';
import { ListBreedQueryDto } from '../dto/list-breed-query.dto';
import { UpdateBreedDto } from '../dto/update-breed.dto';

@Controller('breeds')
@UseGuards(JwtAuthGuard, SessionGuard)
export class BreedController {
  constructor(private readonly breedService: BreedService) {}

  @Post()
  create(
    @Body() dto: CreateBreedDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.breedService.create(this.userId(request), dto);
  }

  @Get()
  findAll(
    @Query() query: ListBreedQueryDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.breedService.findAll(this.userId(request), query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.breedService.findOne(this.userId(request), id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBreedDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.breedService.update(this.userId(request), id, dto);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.breedService.archive(this.userId(request), id);
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.breedService.restore(this.userId(request), id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.breedService.remove(this.userId(request), id);
  }

  private userId(request: AuthenticatedHttpRequest) {
    const userId = request.auth?.user.sub;
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }
    return userId;
  }
}
