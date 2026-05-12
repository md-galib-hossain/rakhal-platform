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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      load: [appConfig, authConfig, databaseConfig, redisConfig],

      expandVariables: true,

      cache: true,
    }),
    UsersModule,
    PrismaModule,
  ],
})
export class AppModule {}
