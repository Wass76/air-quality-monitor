import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AirQualityAlertEvent, CityName } from '@app/common';
import { AppLoggerService } from '@app/logger';
import { PrismaService } from '../prisma/prisma.service';
import { decideDedup } from '../threshold/alert-dedup.policy';

export const OUTBOX_AGGREGATE_ALERT = 'air_quality_alert';

@Injectable()
export class AlertOutboxService {
  private readonly logger: AppLoggerService;
  private readonly cooldownMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(AlertOutboxService.name);
    this.cooldownMs = Number(config.get('ALERT_COOLDOWN_MS') ?? 5 * 60_000);
  }

  /** Persist recovery / non-critical edge so the next cross can fire. */
  async markHealthy(city: CityName): Promise<void> {
    await this.persistDecision(city, false, null);
  }

  /**
   * Atomically: evaluate dedup → insert outbox row → persist city state.
   * Returns the event when enqueued, null when suppressed.
   */
  async enqueueAlert(
    city: CityName,
    buildEvent: () => AirQualityAlertEvent,
  ): Promise<AirQualityAlertEvent | null> {
    return this.persistDecision(city, true, buildEvent);
  }

  private async persistDecision(
    city: CityName,
    isExceeding: boolean,
    buildEvent: (() => AirQualityAlertEvent) | null,
  ): Promise<AirQualityAlertEvent | null> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.cityAlertState.findUnique({ where: { city } });
      const nowMs = Date.now();
      const decision = decideDedup({
        current: row
          ? {
              wasExceeding: row.wasExceeding,
              lastPublishedAtMs: row.lastPublishedAt?.getTime() ?? 0,
            }
          : null,
        isExceeding,
        nowMs,
        cooldownMs: this.cooldownMs,
      });

      const lastPublishedAt =
        decision.next.lastPublishedAtMs > 0
          ? new Date(decision.next.lastPublishedAtMs)
          : null;

      await tx.cityAlertState.upsert({
        where: { city },
        create: {
          city,
          wasExceeding: decision.next.wasExceeding,
          lastPublishedAt,
        },
        update: {
          wasExceeding: decision.next.wasExceeding,
          lastPublishedAt,
        },
      });

      if (!decision.allowPublish || !buildEvent) {
        if (isExceeding) {
          this.logger.debug(`Suppressed duplicate alert for ${city}`);
        }
        return null;
      }

      const event = buildEvent();
      await tx.outboxMessage.create({
        data: {
          eventId: event.eventId,
          aggregateType: OUTBOX_AGGREGATE_ALERT,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });

      this.logger.log(`Enqueued alert to outbox for ${city}`, {
        eventId: event.eventId,
        aqi: event.aqi,
        triggeredBy: event.triggeredBy,
      });

      return event;
    });
  }
}
