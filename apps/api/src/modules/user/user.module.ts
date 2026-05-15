import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { UserService } from 'src/modules/user/user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [LoggerModule],
})
export class UsersModule {}
