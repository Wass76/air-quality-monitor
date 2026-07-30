import { Module } from '@nestjs/common';
import { GoogleAqiModule } from '../google-aqi/google-aqi.module';
import { ThresholdModule } from '../threshold/threshold.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PollingService } from './polling.service';
import { PollingScheduler } from './polling.scheduler';

@Module({
  imports: [GoogleAqiModule, ThresholdModule, OutboxModule],
  providers: [PollingService, PollingScheduler],
})
export class SchedulerModule {}
