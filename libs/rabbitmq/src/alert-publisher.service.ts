import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { AirQualityAlertEvent } from '@app/common';
import { AppLoggerService } from '@app/logger';
import { RABBITMQ_CLIENT, rabbitMqTopology } from './rabbitmq.constants';

const PUBLISH_TIMEOUT_MS = 10_000;

function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const message =
      (typeof record.message === 'string' && record.message) ||
      (typeof record.err === 'object' &&
        record.err !== null &&
        typeof (record.err as { message?: unknown }).message === 'string' &&
        (record.err as { message: string }).message) ||
      JSON.stringify(error);
    return { message };
  }
  return { message: String(error) };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * Thin publisher over Nest RMQ ClientProxy.
 * Messages are persistent (see buildRmqClientOptions).
 * Failures are logged and rethrown so the outbox relay can backoff.
 */
@Injectable()
export class AlertPublisherService implements OnModuleDestroy {
  private readonly logger: AppLoggerService;

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(AlertPublisherService.name);
  }

  async publishAlert(event: AirQualityAlertEvent): Promise<void> {
    try {
      await withTimeout(
        this.client.connect(),
        PUBLISH_TIMEOUT_MS,
        'RabbitMQ client.connect()',
      );
      await firstValueFrom(
        this.client
          .emit(rabbitMqTopology.pattern, event)
          .pipe(timeout(PUBLISH_TIMEOUT_MS)),
      );
      this.logger.debug('Published alert event', {
        eventId: event.eventId,
        city: event.city,
        aqi: event.aqi,
      });
    } catch (error) {
      const { message, stack } = formatError(error);
      this.logger.error(`Failed to publish alert: ${message}`, stack);
      throw error instanceof Error ? error : new Error(message);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
