import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { appConfig } from 'src/core/config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  await app.listen(port);
}
void bootstrap();
