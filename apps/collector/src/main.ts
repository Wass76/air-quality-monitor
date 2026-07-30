import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CollectorModule } from './collector.module';
import { AppLoggerService } from '@app/logger';

async function bootstrap() {
  const app = await NestFactory.create(CollectorModule, { bufferLogs: true });
  const logger = await app.resolve(AppLoggerService);
  logger.setContext('CollectorBootstrap');
  app.useLogger(logger);
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  const port = Number(config.get('PORT') ?? 3001);

  await app.listen(port);
  logger.log(`Collector service listening on :${port}`);
}

void bootstrap();
