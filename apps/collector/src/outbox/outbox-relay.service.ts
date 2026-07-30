import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  BeforeApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AirQualityAlertEvent } from '@app/common';
import { AppLoggerService } from '@app/logger';
import { AlertPublisherService } from '@app/rabbitmq';
import { PrismaService } from '../prisma/prisma.service';

export const OUTBOX_BACKOFF_MS = [
  5_000, 15_000, 60_000, 300_000, 1_800_000,
] as const;

export const OUTBOX_MAX_ATTEMPTS = 10;

export function computeNextAttemptAt(attemptsAfterFailure: number): Date {
  const idx = Math.min(
    Math.max(attemptsAfterFailure - 1, 0),
    OUTBOX_BACKOFF_MS.length - 1,
  );
  const jitter = Math.floor(Math.random() * 1_000);
  return new Date(Date.now() + OUTBOX_BACKOFF_MS[idx] + jitter);
}

/**
 * Polls unpublished outbox rows and publishes them to RabbitMQ.
 * Uses exponential backoff via nextAttemptAt; terminal failures set failedAt.
 */
@Injectable()
export class OutboxRelayService
  implements OnModuleInit, OnModuleDestroy, BeforeApplicationShutdown
{
  private readonly logger: AppLoggerService;
  private readonly batchSize: number;
  private readonly intervalMs: number;
  private inFlight = false;
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: AlertPublisherService,
    private readonly config: ConfigService,
    private readonly registry: SchedulerRegistry,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(OutboxRelayService.name);
    this.batchSize = Number(config.get('OUTBOX_BATCH_SIZE') ?? 20);
    this.intervalMs = Number(config.get('OUTBOX_RELAY_INTERVAL_MS') ?? 1_000);
  }

  onModuleInit(): void {
    const interval = setInterval(() => {
      void this.relayPending();
    }, this.intervalMs);
    this.registry.addInterval('outbox-relay', interval);
    this.logger.log(
      `Outbox relay started (every ${this.intervalMs}ms, batch ${this.batchSize})`,
    );
    void this.relayPending();
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.stopped = true;
    this.clearInterval();
    await this.waitForIdle();
  }

  onModuleDestroy(): void {
    this.stopped = true;
    this.clearInterval();
  }

  private clearInterval(): void {
    try {
      this.registry.deleteInterval('outbox-relay');
    } catch {
      // interval may not be registered in tests
    }
  }

  async waitForIdle(timeoutMs = 15_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (this.inFlight && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async relayPending(): Promise<void> {
    if (this.stopped || this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      const now = new Date();
      const pending = await this.prisma.outboxMessage.findMany({
        where: {
          publishedAt: null,
          failedAt: null,
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: this.batchSize,
      });

      for (const row of pending) {
        if (this.stopped) {
          break;
        }
        try {
          const event = row.payload as unknown as AirQualityAlertEvent;
          await this.publisher.publishAlert(event);
          await this.prisma.outboxMessage.update({
            where: { id: row.id },
            data: {
              publishedAt: new Date(),
              lastError: null,
              nextAttemptAt: null,
              failedAt: null,
            },
          });
          this.logger.debug('Outbox message published', {
            eventId: row.eventId,
            id: row.id,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const nextAttempts = row.attempts + 1;
          const terminal = nextAttempts >= OUTBOX_MAX_ATTEMPTS;

          await this.prisma.outboxMessage.update({
            where: { id: row.id },
            data: {
              attempts: nextAttempts,
              lastError: message.slice(0, 1000),
              nextAttemptAt: terminal
                ? null
                : computeNextAttemptAt(nextAttempts),
              failedAt: terminal ? new Date() : null,
            },
          });

          if (terminal) {
            this.logger.error(
              `Outbox permanently failed for ${row.eventId} after ${nextAttempts} attempts: ${message}`,
              error instanceof Error ? error.stack : undefined,
            );
          } else {
            this.logger.error(
              `Outbox publish failed for ${row.eventId} (attempt ${nextAttempts}): ${message}`,
              error instanceof Error ? error.stack : undefined,
            );
          }
        }
      }
    } finally {
      this.inFlight = false;
    }
  }
}
