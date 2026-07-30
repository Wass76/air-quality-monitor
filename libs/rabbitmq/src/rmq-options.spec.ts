import {
  buildDlqQueueOptions,
  buildMainQueueOptions,
  buildRetryQueueOptions,
  rabbitMqTopology,
} from './rabbitmq.constants';
import {
  buildRmqClientOptions,
  buildRmqMicroserviceOptions,
} from './rmq-options';

describe('rmq options / topology', () => {
  it('uses durable main queue with dead-letter to retry', () => {
    const options = buildMainQueueOptions();
    expect(options.durable).toBe(true);
    expect(options.arguments['x-dead-letter-routing-key']).toBe(
      rabbitMqTopology.retryQueue,
    );
  });

  it('uses durable retry queue with TTL back to main', () => {
    const options = buildRetryQueueOptions();
    expect(options.durable).toBe(true);
    expect(options.arguments['x-message-ttl']).toBe(
      rabbitMqTopology.retryTtlMs,
    );
    expect(options.arguments['x-dead-letter-routing-key']).toBe(
      rabbitMqTopology.queue,
    );
  });

  it('uses durable DLQ', () => {
    expect(buildDlqQueueOptions()).toEqual({ durable: true });
  });

  it('publishes persistent client messages', () => {
    const client = buildRmqClientOptions('amqp://localhost');
    expect(client.options?.persistent).toBe(true);
    expect(client.options?.queueOptions?.durable).toBe(true);
  });

  it('configures consumer with noAck false and same queue options', () => {
    const consumer = buildRmqMicroserviceOptions(['amqp://localhost']);
    expect(consumer.options?.noAck).toBe(false);
    expect(consumer.options?.queueOptions).toEqual(buildMainQueueOptions());
  });
});
