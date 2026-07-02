import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from 'src/core/config/env';
import { sentryConfig } from 'src/core/config/env';
import helmet from 'helmet';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import cookieParser from 'cookie-parser';
import { SentryService } from 'src/core/observability/sentry/sentry.service';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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

  const { apiPrefix, name, appVersion, swaggerEnabled } = app.get<
    ConfigType<typeof appConfig>
  >(appConfig.KEY);
  // Health/readiness probes and the Prometheus scrape stay un-prefixed so
  // infra (k8s, Prometheus) keeps hitting /health, /ready, /live, /metrics.
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'health', method: RequestMethod.GET },
      { path: 'ready', method: RequestMethod.GET },
      { path: 'live', method: RequestMethod.GET },
      { path: 'metrics', method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Dev/staging-only API docs (never production — see appConfig.swaggerEnabled).
  // Built after setGlobalPrefix so documented paths match what's actually served.
  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle(`${name} API`)
      .setDescription(
        'API documentation for the Rakhal dairy-farm operations backend',
      )
      .setVersion(appVersion)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.warn('Swagger docs enabled at /api/docs (non-production only)');
  }

  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(port);
}

void bootstrap();
