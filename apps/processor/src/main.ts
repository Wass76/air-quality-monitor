import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { ProcessorModule } from './processor.module';
import { AppLoggerService } from '@app/logger';
import { buildRmqMicroserviceOptions } from '@app/rabbitmq';

async function bootstrap() {
  const app = await NestFactory.create(ProcessorModule, { bufferLogs: true });
  const logger = await app.resolve(AppLoggerService);
  logger.setContext('ProcessorBootstrap');
  app.useLogger(logger);
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const config = app.get(ConfigService);
  const rabbitUrl = config.getOrThrow<string>('RABBITMQ_URL');
  const port = Number(config.get('PORT') ?? 3002);

  app.connectMicroservice(buildRmqMicroserviceOptions([rabbitUrl]));
  await app.startAllMicroservices();
  await app.listen(port);

  logger.log(`Processor hybrid service listening on :${port} (HTTP + RMQ)`);
}

void bootstrap();
