import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from 'src/core/config/env';
import { sentryConfig } from 'src/core/config/env';
import helmet from 'helmet';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import cookieParser from 'cookie-parser';
import { SentryService } from 'src/core/observability/sentry/sentry.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = await app.resolve(LoggerService);
  const sentry = await app.resolve(SentryService);
  app.useLogger(logger);
  sentry.initialize(app.get(sentryConfig.KEY));

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(port);
}

void bootstrap();
