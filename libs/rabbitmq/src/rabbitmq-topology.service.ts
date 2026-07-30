import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, {
  ChannelWrapper,
  AmqpConnectionManager,
} from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { AppLoggerService } from '@app/logger';
import {
  buildDlqQueueOptions,
  buildMainQueueOptions,
  buildRetryQueueOptions,
  rabbitMqTopology,
} from './rabbitmq.constants';

const TOPOLOGY_CONNECT_ATTEMPTS = 10;
const TOPOLOGY_CONNECT_DELAY_MS = 2_000;

/**
 * Asserts main / retry / DLQ topology once per process so publisher and
 * consumer share identical durable queue definitions.
 */
@Injectable()
export class RabbitMqTopologyService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: AppLoggerService;
  private connection: AmqpConnectionManager | null = null;
  private channel: ChannelWrapper | null = null;
  private connected = false;
  private readonly onConnect = (): void => {
    this.connected = true;
  };
  private readonly onDisconnect = (): void => {
    this.connected = false;
  };

  constructor(
    private readonly config: ConfigService,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(RabbitMqTopologyService.name);
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.getOrThrow<string>('RABBITMQ_URL');
    this.connection = amqp.connect([url]);
    this.connection.on('connect', this.onConnect);
    this.connection.on('disconnect', this.onDisconnect);

    this.channel = this.connection.createChannel({
      json: false,
      setup: async (ch: ConfirmChannel) => {
        await ch.assertQueue(rabbitMqTopology.queue, buildMainQueueOptions());
        await ch.assertQueue(
          rabbitMqTopology.retryQueue,
          buildRetryQueueOptions(),
        );
        await ch.assertQueue(rabbitMqTopology.dlq, buildDlqQueueOptions());
      },
    });

    let lastError: unknown;
    for (let attempt = 1; attempt <= TOPOLOGY_CONNECT_ATTEMPTS; attempt++) {
      try {
        await this.channel.waitForConnect();
        this.connected = true;
        this.logger.log(
          `RMQ topology ready: ${rabbitMqTopology.queue}, ${rabbitMqTopology.retryQueue}, ${rabbitMqTopology.dlq}`,
        );
        return;
      } catch (error) {
        lastError = error;
        this.connected = false;
        this.logger.warn(
          `RMQ topology connect attempt ${attempt}/${TOPOLOGY_CONNECT_ATTEMPTS} failed`,
        );
        if (attempt < TOPOLOGY_CONNECT_ATTEMPTS) {
          await new Promise((resolve) =>
            setTimeout(resolve, TOPOLOGY_CONNECT_DELAY_MS),
          );
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('RMQ topology failed to connect');
  }

  async isReady(timeoutMs = 3_000): Promise<boolean> {
    if (!this.channel || !this.connected) {
      return false;
    }
    try {
      await Promise.race([
        this.channel.checkQueue(rabbitMqTopology.queue),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('RMQ readiness timeout')),
            timeoutMs,
          ),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  async publishToDlq(
    content: Buffer,
    properties?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RMQ topology channel not ready');
    }
    await this.channel.sendToQueue(rabbitMqTopology.dlq, content, {
      persistent: true,
      ...properties,
    });
  }

  async onModuleDestroy(): Promise<void> {
    this.connection?.off('connect', this.onConnect);
    this.connection?.off('disconnect', this.onDisconnect);
    try {
      await this.channel?.close();
    } catch {
      // ignore
    }
    try {
      await this.connection?.close();
    } catch {
      // ignore
    }
    this.connected = false;
  }
}
