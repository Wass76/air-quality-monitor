import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateCollectorEnv } from '@app/config';
import { LoggerModule } from '@app/logger';
import { RabbitMqModule } from '@app/rabbitmq';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateCollectorEnv,
    }),
    LoggerModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    RabbitMqModule.forRootAsync(),
    SchedulerModule,
    HealthModule,
  ],
})
export class CollectorModule {}
