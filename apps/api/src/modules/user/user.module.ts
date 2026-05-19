import { Module } from '@nestjs/common';
import { UserController } from './presentation/controllers/user.controller';
import { LoggerModule } from 'src/core/logger/logger/logger.module';
import { UserService } from 'src/modules/user/application/services/user.service';

@Module({
  controllers: [UserController],
  providers: [UserService],
  imports: [LoggerModule],
})
export class UsersModule {}
