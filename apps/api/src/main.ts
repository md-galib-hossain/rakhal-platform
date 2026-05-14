import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from 'src/core/config/env';
import helmet from 'helmet';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // ✅ Get your custom logger from DI
  const logger = app.get(LoggerService);
  app.useLogger(logger);
  // ✅ Register global filter using DI-resolved logger
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  app.use(helmet());

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
