import { Controller, BeforeApplicationShutdown } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { ALERT_CREATED_PATTERN } from '@app/common';
import { AppLoggerService } from '@app/logger';
import {
  RabbitMqTopologyService,
  classifyFailure,
  deliveryAttemptCount,
  shouldMoveToDlq,
} from '@app/rabbitmq';
import { AlertsService } from '../alerts/alerts.service';

interface AmqpMessage {
  content: Buffer;
  properties: {
    headers?: Record<string, unknown>;
  };
}

interface AmqpChannel {
  ack(message: AmqpMessage): void;
  nack(message: AmqpMessage, allUpTo: boolean, requeue: boolean): void;
}

@Controller()
export class AlertsConsumer implements BeforeApplicationShutdown {
  private readonly logger: AppLoggerService;
  private draining = false;
  private inFlight = 0;

  constructor(
    private readonly alertsService: AlertsService,
    private readonly topology: RabbitMqTopologyService,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(AlertsConsumer.name);
  }

  async beforeApplicationShutdown(): Promise<void> {
    this.draining = true;
    const deadline = Date.now() + 10_000;
    while (this.inFlight > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  @EventPattern(ALERT_CREATED_PATTERN)
  async handleAlert(
    @Payload() payload: unknown,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef() as AmqpChannel;
    const originalMsg = context.getMessage() as AmqpMessage;

    if (this.draining) {
      channel.nack(originalMsg, false, true);
      return;
    }

    const attempts = deliveryAttemptCount(originalMsg);
    this.inFlight += 1;
    try {
      await this.alertsService.processIncoming(payload);
      channel.ack(originalMsg);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process alert message (attempt=${attempts}): ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      const failure = classifyFailure(error, attempts);
      if (shouldMoveToDlq(failure)) {
        await this.moveToDlqOrDrop(channel, originalMsg, message, attempts);
        return;
      }

      channel.nack(originalMsg, false, false);
    } finally {
      this.inFlight -= 1;
    }
  }

  /**
   * Prefer DLQ publish + ack. If DLQ publish fails for a permanent poison
   * message, nack without requeue so the main-queue DLX routes toward retry
   * (bounded) instead of hot-looping with requeue=true.
   */
  private async moveToDlqOrDrop(
    channel: AmqpChannel,
    originalMsg: AmqpMessage,
    message: string,
    attempts: number,
  ): Promise<void> {
    try {
      await this.topology.publishToDlq(originalMsg.content, {
        headers: {
          ...(originalMsg.properties?.headers ?? {}),
          'x-final-error': message.slice(0, 500),
          'x-delivery-attempts': attempts + 1,
        },
      });
      channel.ack(originalMsg);
      this.logger.warn(`Alert moved to DLQ after ${attempts + 1} attempt(s)`);
    } catch (dlqError) {
      this.logger.error(
        `Failed to publish to DLQ; nack without requeue to avoid hot loop: ${
          dlqError instanceof Error ? dlqError.message : String(dlqError)
        }`,
      );
      channel.nack(originalMsg, false, false);
    }
  }
}
