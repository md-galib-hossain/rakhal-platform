import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
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
import { RequestContextMiddleware } from 'src/common/middleware/request-context.middleware';
import { LoggerMiddleware } from 'src/core/logger/logger/logger.middleware';
import { APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';

@Module({
  imports: [
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
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        RequestContextMiddleware, // runs first: generates & stamps IDs
        LoggerMiddleware, // runs second: reads IDs, sets async context
      )
      // ✅ Correct wildcard for NestJS v10+
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
