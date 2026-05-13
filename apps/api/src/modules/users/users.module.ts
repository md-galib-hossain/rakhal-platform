import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from 'src/modules/users/users.service';
import { LoggerModule } from 'src/core/logger/logger/logger.module';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  imports: [LoggerModule],
})
export class UsersModule {}
