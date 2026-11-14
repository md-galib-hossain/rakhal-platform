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
import type { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const logger = await app.resolve(LoggerService);
  const sentry = await app.resolve(SentryService);
  app.useLogger(logger);
  sentry.initialize(app.get(sentryConfig.KEY));

  app.use(helmet());
  app.use(cookieParser());

  const {
    apiPrefix,
    name,
    appVersion,
    swaggerEnabled,
    trustProxyHops,
    isProduction,
    allowedOrigins,
  } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // RD-041: `origin: true` reflects whatever `Origin` header the caller
  // sends back into `Access-Control-Allow-Origin`, and combined with
  // `credentials: true` that means any website a logged-in user visits can
  // drive this API as that user (a real cross-origin vulnerability, not a
  // hardening nicety). Production must supply a real ALLOWED_ORIGINS
  // allowlist; failing to boot beats booting wide open. Non-production keeps
  // the old reflect-any-origin behavior so local dev/CI/preview stay
  // unaffected without per-branch config.
  if (isProduction && allowedOrigins.length === 0) {
    throw new Error(
      'ALLOWED_ORIGINS must be set in production (comma-separated origin list) — refusing to boot with CORS open to any origin.',
    );
  }
  app.enableCors({
    origin: isProduction ? allowedOrigins : true,
    credentials: true,
  });

  // Behind Nginx (and optionally Cloudflare) req.ip is the proxy's own address
  // unless Express is told how many hops to skip. Everything that keys on the
  // client IP depends on this: the throttler's tracker and the IP recorded on
  // audit/lockout rows. Set as a *count*, never `true` — see TRUST_PROXY_HOPS
  // in env.schema.ts for why a boolean is spoofable.
  if (trustProxyHops > 0) {
    app.set('trust proxy', trustProxyHops);
    logger.log(`Trusting ${trustProxyHops} reverse-proxy hop(s) for client IP`);
  }
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
