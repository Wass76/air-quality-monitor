import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MONITORED_CITIES, MonitoredCity } from '@app/common';
import { AppLoggerService } from '@app/logger';
import { AIR_QUALITY_PROVIDER } from '../google-aqi/air-quality.provider';
import type { AirQualityProvider } from '../google-aqi/air-quality.provider';
import { ThresholdEvaluator } from '../threshold/threshold.evaluator';
import { AlertOutboxService } from '../outbox/alert-outbox.service';

@Injectable()
export class PollingService {
  private readonly logger: AppLoggerService;
  private inFlight = false;
  private stopped = false;

  constructor(
    @Inject(AIR_QUALITY_PROVIDER)
    private readonly airQuality: AirQualityProvider,
    private readonly evaluator: ThresholdEvaluator,
    private readonly outbox: AlertOutboxService,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(PollingService.name);
  }

  stop(): void {
    this.stopped = true;
  }

  async waitForIdle(timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.inFlight && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async pollAllCities(): Promise<void> {
    if (this.stopped) {
      return;
    }
    if (this.inFlight) {
      this.logger.warn('Skipping poll tick — previous cycle still running');
      return;
    }

    this.inFlight = true;
    try {
      const results = await Promise.allSettled(
        MONITORED_CITIES.map((city) => this.pollCity(city)),
      );

      const failures = results.filter((r) => r.status === 'rejected').length;
      if (failures > 0) {
        this.logger.warn(
          `Poll cycle finished with ${failures} city failure(s)`,
        );
      } else {
        this.logger.debug('Poll cycle completed for all cities');
      }
    } finally {
      this.inFlight = false;
    }
  }

  private async pollCity(city: MonitoredCity): Promise<void> {
    try {
      const reading = await this.airQuality.fetchCurrentConditions(city);
      const evaluation = this.evaluator.evaluate(reading);

      if (evaluation.state === 'healthy') {
        await this.outbox.markHealthy(city.name);
        this.logger.debug(`Air quality OK for ${city.name}`, {
          aqi: reading.aqi,
          pm25: reading.pm25,
          pm10: reading.pm10,
        });
        return;
      }

      if (evaluation.state === 'hold') {
        this.logger.debug(`Air quality hold band for ${city.name}`, {
          aqi: reading.aqi,
          pm25: reading.pm25,
          pm10: reading.pm10,
        });
        return;
      }

      await this.outbox.enqueueAlert(city.name, () => ({
        eventId: randomUUID(),
        city: reading.city,
        regionCode: reading.regionCode,
        latitude: reading.latitude,
        longitude: reading.longitude,
        aqi: reading.aqi,
        indexCode: reading.indexCode,
        scaleDirection: reading.scaleDirection,
        uaqi: reading.uaqi,
        category: reading.category,
        dominantPollutant: reading.dominantPollutant,
        colorHex: reading.colorHex,
        pm25: reading.pm25,
        pm10: reading.pm10,
        triggeredBy: evaluation.triggeredBy,
        observedAt: reading.observedAt,
        publishedAt: new Date().toISOString(),
      }));
      // OutboxRelay publishes asynchronously: outbox → RabbitMQ.
    } catch (error) {
      this.logger.error(
        `Failed to poll ${city.name}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
