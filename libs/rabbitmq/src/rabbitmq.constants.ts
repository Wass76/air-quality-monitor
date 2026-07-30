import {
  ALERT_CREATED_PATTERN,
  RABBITMQ_DLQ,
  RABBITMQ_EXCHANGE,
  RABBITMQ_MAX_DELIVERY_ATTEMPTS,
  RABBITMQ_QUEUE,
  RABBITMQ_RETRY_QUEUE,
  RABBITMQ_RETRY_TTL_MS,
  RABBITMQ_ROUTING_KEY,
} from '@app/common';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

export const rabbitMqTopology = {
  exchange: RABBITMQ_EXCHANGE,
  exchangeType: 'topic' as const,
  queue: RABBITMQ_QUEUE,
  retryQueue: RABBITMQ_RETRY_QUEUE,
  dlq: RABBITMQ_DLQ,
  routingKey: RABBITMQ_ROUTING_KEY,
  pattern: ALERT_CREATED_PATTERN,
  maxDeliveryAttempts: RABBITMQ_MAX_DELIVERY_ATTEMPTS,
  retryTtlMs: RABBITMQ_RETRY_TTL_MS,
};

export interface RabbitMqModuleOptions {
  urls: string[];
  prefetchCount?: number;
}

/**
 * Shared main-queue options used by BOTH publisher and consumer.
 * Must stay identical — RabbitMQ rejects redeclare with different args
 * (PRECONDITION_FAILED).
 *
 * On nack(requeue=false), messages dead-letter to the retry queue via the
 * default exchange (routing key = queue name).
 */
export function buildMainQueueOptions(): {
  durable: true;
  arguments: Record<string, string | number>;
} {
  return {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': rabbitMqTopology.retryQueue,
    },
  };
}

export function buildRetryQueueOptions(): {
  durable: true;
  arguments: Record<string, string | number>;
} {
  return {
    durable: true,
    arguments: {
      'x-message-ttl': rabbitMqTopology.retryTtlMs,
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': rabbitMqTopology.queue,
    },
  };
}

export function buildDlqQueueOptions(): { durable: true } {
  return { durable: true };
}
