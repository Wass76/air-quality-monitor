import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateProcessorEnv } from '@app/config';
import { LoggerModule } from '@app/logger';
import { RabbitMqModule } from '@app/rabbitmq';
import { PrismaModule } from './prisma/prisma.module';
import { AlertsModule } from './alerts/alerts.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateProcessorEnv,
    }),
    LoggerModule,
    RabbitMqModule.forRootAsync(),
    PrismaModule,
    AlertsModule,
    HealthModule,
  ],
})
export class ProcessorModule {}
