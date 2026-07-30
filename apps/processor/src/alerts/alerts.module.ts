import { Module } from '@nestjs/common';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsRepository } from './alerts.repository';
import { AlertsConsumer } from '../consumer/alerts.consumer';
import { AlertsGateway } from '../realtime/alerts.gateway';

@Module({
  controllers: [AlertsController, AlertsConsumer],
  providers: [AlertsService, AlertsRepository, AlertsGateway],
  exports: [AlertsService, AlertsGateway],
})
export class AlertsModule {}
