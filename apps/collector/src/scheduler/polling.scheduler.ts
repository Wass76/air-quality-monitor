import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppLoggerService } from '@app/logger';
import { PollingService } from './polling.service';

@Injectable()
export class PollingScheduler
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger: AppLoggerService;

  constructor(
    private readonly polling: PollingService,
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(PollingScheduler.name);
  }

  onModuleInit(): void {
    const intervalMs = Number(this.config.get('POLL_INTERVAL_MS') ?? 10_000);
    const interval = setInterval(() => {
      void this.polling.pollAllCities();
    }, intervalMs);

    this.registry.addInterval('air-quality-poll', interval);
    this.logger.log(`Polling scheduler started (every ${intervalMs}ms)`);

    // Kick off immediately so we don't wait for the first interval.
    void this.polling.pollAllCities();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.polling.stop();
    this.clearInterval();
    await this.polling.waitForIdle();
  }

  onModuleDestroy(): void {
    this.polling.stop();
    this.clearInterval();
  }

  private clearInterval(): void {
    try {
      this.registry.deleteInterval('air-quality-poll');
    } catch {
      // interval may not be registered in tests
    }
  }
}
