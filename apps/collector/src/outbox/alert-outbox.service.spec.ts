import { AlertOutboxService } from './alert-outbox.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AppLoggerService } from '@app/logger';

describe('AlertOutboxService', () => {
  function buildService(
    txImpl: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>,
  ) {
    return new AlertOutboxService(
      { $transaction: txImpl } as unknown as PrismaService,
      {
        get: () => 60_000,
      } as unknown as ConfigService,
      {
        setContext: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
      } as unknown as AppLoggerService,
    );
  }

  it('inserts outbox and state on first critical reading', async () => {
    const create = jest.fn().mockResolvedValue({});
    const upsert = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = buildService(async (fn) =>
      fn({
        cityAlertState: { findUnique, upsert },
        outboxMessage: { create },
      }),
    );

    const event = await service.enqueueAlert('Dubai', () => ({
      eventId: 'e1',
      city: 'Dubai',
      regionCode: 'AE',
      latitude: 1,
      longitude: 2,
      aqi: 160,
      indexCode: 'usa_epa',
      scaleDirection: 'higher_is_worse',
      uaqi: 20,
      category: 'Unhealthy',
      dominantPollutant: 'pm25',
      colorHex: '#FF0000',
      pm25: 150,
      pm10: 180,
      triggeredBy: ['LAQI'],
      observedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    }));

    expect(event?.eventId).toBe('e1');
    expect(create).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalled();
  });

  it('suppresses duplicate critical readings during cooldown', async () => {
    const create = jest.fn();
    const upsert = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue({
      wasExceeding: true,
      lastPublishedAt: new Date(),
    });
    const service = buildService(async (fn) =>
      fn({
        cityAlertState: { findUnique, upsert },
        outboxMessage: { create },
      }),
    );

    const event = await service.enqueueAlert('Dubai', () => {
      throw new Error('should not build');
    });
    expect(event).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });

  it('clears exceeding state on markHealthy', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const findUnique = jest.fn().mockResolvedValue({
      wasExceeding: true,
      lastPublishedAt: new Date('2020-01-01T00:00:00Z'),
    });
    const service = buildService(async (fn) =>
      fn({
        cityAlertState: { findUnique, upsert },
        outboxMessage: { create: jest.fn() },
      }),
    );

    await service.markHealthy('Dubai');
    expect(upsert).toHaveBeenCalled();
    const upsertCalls = upsert.mock.calls as Array<
      [{ update: { wasExceeding: boolean } }]
    >;
    expect(upsertCalls[0][0].update.wasExceeding).toBe(false);
  });
});
