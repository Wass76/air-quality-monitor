import { Injectable } from '@nestjs/common';
import { Alert, Prisma } from '@prisma/client';
import { AirQualityAlertEvent } from '@app/common';
import { PrismaService } from '../prisma/prisma.service';

export type CreateOrGetResult = {
  alert: Alert;
  created: boolean;
};

@Injectable()
export class AlertsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetByEventId(
    event: AirQualityAlertEvent,
  ): Promise<CreateOrGetResult> {
    try {
      const alert = await this.createFromEvent(event);
      return { alert, created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.findByEventId(event.eventId);
        if (existing) {
          return { alert: existing, created: false };
        }
      }
      throw error;
    }
  }

  async createFromEvent(event: AirQualityAlertEvent): Promise<Alert> {
    return this.prisma.alert.create({
      data: {
        eventId: event.eventId,
        city: event.city,
        regionCode: event.regionCode,
        aqi: event.aqi,
        indexCode: event.indexCode,
        scaleDirection: event.scaleDirection,
        uaqi: event.uaqi,
        category: event.category,
        pm25: event.pm25,
        pm10: event.pm10,
        dominantPollutant: event.dominantPollutant,
        colorHex: event.colorHex,
        triggeredBy: event.triggeredBy,
        observedAt: new Date(event.observedAt),
      },
    });
  }

  async findByEventId(eventId: string): Promise<Alert | null> {
    return this.prisma.alert.findUnique({ where: { eventId } });
  }

  async findRecent(limit = 20): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      orderBy: { observedAt: 'desc' },
      take: limit,
    });
  }
}
