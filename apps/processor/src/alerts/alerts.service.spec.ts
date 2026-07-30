import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { AlertsRepository } from './alerts.repository';
import { AlertsService } from './alerts.service';
import { AlertsGateway } from '../realtime/alerts.gateway';
import { AppLoggerService } from '@app/logger';

function validPayload(eventId = '11111111-1111-4111-8111-111111111111') {
  return {
    eventId,
    city: 'Dubai',
    regionCode: 'AE',
    latitude: 25.2,
    longitude: 55.2,
    aqi: 160,
    indexCode: 'usa_epa',
    scaleDirection: 'higher_is_worse',
    uaqi: 30,
    category: 'Unhealthy',
    dominantPollutant: 'pm25',
    colorHex: '#FF0000',
    pm25: 150,
    pm10: 180,
    triggeredBy: ['LAQI'],
    observedAt: '2026-07-30T06:00:00.000Z',
    publishedAt: '2026-07-30T06:00:01.000Z',
  };
}

describe('AlertsService', () => {
  const alertRow = {
    id: '1',
    eventId: validPayload().eventId,
    city: 'Dubai',
    aqi: 160,
    category: 'Unhealthy',
    observedAt: new Date('2026-07-30T06:00:00.000Z'),
  };

  it('broadcasts and logs only when created', async () => {
    const repository = {
      createOrGetByEventId: jest.fn().mockResolvedValue({
        alert: alertRow,
        created: true,
      }),
    };
    const gateway = { broadcastAlert: jest.fn() };
    const logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
    const service = new AlertsService(
      repository as unknown as AlertsRepository,
      gateway as unknown as AlertsGateway,
      logger as unknown as AppLoggerService,
    );

    const result = await service.processIncoming(validPayload());
    expect(result?.city).toBe('Dubai');
    expect(gateway.broadcastAlert).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenCalled();
  });

  it('acks duplicates without broadcast or critical log', async () => {
    const repository = {
      createOrGetByEventId: jest.fn().mockResolvedValue({
        alert: alertRow,
        created: false,
      }),
    };
    const gateway = { broadcastAlert: jest.fn() };
    const logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
    const service = new AlertsService(
      repository as unknown as AlertsRepository,
      gateway as unknown as AlertsGateway,
      logger as unknown as AppLoggerService,
    );

    await service.processIncoming(validPayload());
    expect(gateway.broadcastAlert).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('maps recent alerts for REST', async () => {
    const repository = {
      findRecent: jest.fn().mockResolvedValue([alertRow]),
    };
    const gateway = { broadcastAlert: jest.fn() };
    const logger = {
      setContext: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
    };
    const service = new AlertsService(
      repository as unknown as AlertsRepository,
      gateway as unknown as AlertsGateway,
      logger as unknown as AppLoggerService,
    );

    const rows = await service.getRecentAlerts(5);
    expect(repository.findRecent).toHaveBeenCalledWith(5);
    expect(rows).toEqual([
      {
        city: 'Dubai',
        aqi: 160,
        category: 'Unhealthy',
        timestamp: '2026-07-30T06:00:00.000Z',
      },
    ]);
  });
});

describe('AlertsRepository.createOrGetByEventId', () => {
  it('returns created=false on Prisma P2002', async () => {
    const existing = { id: '1', eventId: 'e1' };
    const prisma = {
      alert: {
        create: jest.fn().mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('dup', {
            code: 'P2002',
            clientVersion: '6.19.3',
          }),
        ),
        findUnique: jest.fn().mockResolvedValue(existing),
      },
    };
    const repository = new AlertsRepository(prisma as never);
    const result = await repository.createOrGetByEventId(
      validPayload() as never,
    );
    expect(result).toEqual({ alert: existing, created: false });
  });
});
