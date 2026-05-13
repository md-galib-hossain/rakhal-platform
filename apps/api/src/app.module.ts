import { Module } from '@nestjs/common';

import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './core/database/prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import {
  appConfig,
  authConfig,
  databaseConfig,
  redisConfig,
} from 'src/core/config/env';
import { LoggerModule } from 'src/core/logger/logger/logger.module';

@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',

      load: [appConfig, authConfig, databaseConfig, redisConfig],

      expandVariables: true,

      cache: true,
    }),
    UsersModule,
    PrismaModule,
    LoggerModule,
  ],
})
export class AppModule {}
