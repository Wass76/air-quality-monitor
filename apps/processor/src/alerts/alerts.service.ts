import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { AirQualityAlertEvent, AlertPublicDto } from '@app/common';
import { AppLoggerService } from '@app/logger';
import { AirQualityAlertEventDto } from './dto/air-quality-alert-event.dto';
import { AlertsRepository } from './alerts.repository';
import { AlertsGateway } from '../realtime/alerts.gateway';

@Injectable()
export class AlertsService {
  private readonly logger: AppLoggerService;

  constructor(
    private readonly repository: AlertsRepository,
    private readonly gateway: AlertsGateway,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(AlertsService.name);
  }

  async processIncoming(payload: unknown): Promise<AlertPublicDto | null> {
    const dto = plainToInstance(AirQualityAlertEventDto, payload);
    await validateOrReject(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    const event = dto as unknown as AirQualityAlertEvent;
    const { alert, created } =
      await this.repository.createOrGetByEventId(event);
    const publicDto = this.toPublic(alert);

    if (!created) {
      this.logger.warn('Duplicate eventId ignored (idempotent)', {
        eventId: event.eventId,
      });
      return publicDto;
    }

    this.logCriticalAlert(event);
    this.gateway.broadcastAlert(publicDto);
    return publicDto;
  }

  async getRecentAlerts(limit = 20): Promise<AlertPublicDto[]> {
    const rows = await this.repository.findRecent(limit);
    return rows.map((row) => this.toPublic(row));
  }

  private toPublic(row: {
    city: string;
    aqi: number;
    category: string;
    observedAt: Date;
  }): AlertPublicDto {
    return {
      city: row.city,
      aqi: row.aqi,
      category: row.category,
      timestamp: row.observedAt.toISOString(),
    };
  }

  private logCriticalAlert(event: AirQualityAlertEvent): void {
    const lines = [
      '[ALERT] CRITICAL AIR QUALITY DETECTED',
      `City: ${event.city} | Region: ${event.regionCode}`,
      `AQI: ${event.aqi} (${event.indexCode}, ${event.scaleDirection}) | Category: ${event.category}`,
      `UAQI: ${event.uaqi ?? 'n/a'} | Dominant: ${event.dominantPollutant} | Color: ${event.colorHex}`,
      `PM2.5: ${event.pm25 ?? 'n/a'} μg/m³ | PM10: ${event.pm10 ?? 'n/a'} μg/m³`,
      `TriggeredBy: ${event.triggeredBy.join(', ')} | EventId: ${event.eventId}`,
    ];
    this.logger.log(lines.join('\n'));
  }
}
