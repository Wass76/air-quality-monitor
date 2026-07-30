import {
  OUTBOX_MAX_ATTEMPTS,
  OutboxRelayService,
  computeNextAttemptAt,
} from './outbox-relay.service';
import { PrismaService } from '../prisma/prisma.service';
import { AlertPublisherService } from '@app/rabbitmq';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AppLoggerService } from '@app/logger';

describe('OutboxRelayService', () => {
  const findMany = jest.fn();
  const update = jest.fn();
  const publishAlert = jest.fn();
  const deleteInterval = jest.fn();
  const addInterval = jest.fn();

  function buildService() {
    return new OutboxRelayService(
      {
        outboxMessage: { findMany, update },
      } as unknown as PrismaService,
      { publishAlert } as unknown as AlertPublisherService,
      {
        get: (key: string) =>
          key === 'OUTBOX_BATCH_SIZE'
            ? 20
            : key === 'OUTBOX_RELAY_INTERVAL_MS'
              ? 1000
              : undefined,
      } as unknown as ConfigService,
      { addInterval, deleteInterval } as unknown as SchedulerRegistry,
      {
        setContext: jest.fn(),
        log: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
      } as unknown as AppLoggerService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    update.mockResolvedValue({});
  });

  it('marks publishedAt on successful publish', async () => {
    findMany.mockResolvedValue([
      {
        id: '1',
        eventId: 'e1',
        attempts: 0,
        payload: { eventId: 'e1', city: 'Dubai' },
      },
    ]);
    publishAlert.mockResolvedValue(undefined);
    const service = buildService();
    await service.relayPending();
    expect(update).toHaveBeenCalled();
    const calls = update.mock.calls as Array<
      [{ where: { id: string }; data: { publishedAt: Date } }]
    >;
    expect(calls[0][0].where.id).toBe('1');
    expect(calls[0][0].data.publishedAt).toBeInstanceOf(Date);
  });

  it('applies backoff on transient publish failure', async () => {
    findMany.mockResolvedValue([
      {
        id: '1',
        eventId: 'e1',
        attempts: 0,
        payload: { eventId: 'e1' },
      },
    ]);
    publishAlert.mockRejectedValue(new Error('broker down'));
    const service = buildService();
    await service.relayPending();
    const calls = update.mock.calls as Array<
      [
        {
          data: {
            attempts: number;
            failedAt: Date | null;
            nextAttemptAt: Date | null;
          };
        },
      ]
    >;
    expect(calls[0][0].data.attempts).toBe(1);
    expect(calls[0][0].data.failedAt).toBeNull();
    expect(calls[0][0].data.nextAttemptAt).toBeInstanceOf(Date);
  });

  it('sets failedAt after max attempts', async () => {
    findMany.mockResolvedValue([
      {
        id: '1',
        eventId: 'e1',
        attempts: OUTBOX_MAX_ATTEMPTS - 1,
        payload: { eventId: 'e1' },
      },
    ]);
    publishAlert.mockRejectedValue(new Error('broker down'));
    const service = buildService();
    await service.relayPending();
    const calls = update.mock.calls as Array<
      [
        {
          data: {
            attempts: number;
            failedAt: Date | null;
            nextAttemptAt: Date | null;
          };
        },
      ]
    >;
    expect(calls[0][0].data.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    expect(calls[0][0].data.failedAt).toBeInstanceOf(Date);
    expect(calls[0][0].data.nextAttemptAt).toBeNull();
  });

  it('suppresses overlapping relay ticks', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    findMany.mockImplementation(async () => {
      await gate;
      return [];
    });
    const service = buildService();
    const first = service.relayPending();
    const second = service.relayPending();
    release();
    await Promise.all([first, second]);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it('computeNextAttemptAt increases with attempts', () => {
    const early = computeNextAttemptAt(1).getTime();
    const later = computeNextAttemptAt(5).getTime();
    expect(later).toBeGreaterThan(early);
  });
});
