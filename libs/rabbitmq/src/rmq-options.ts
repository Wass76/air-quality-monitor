import { Transport, RmqOptions } from '@nestjs/microservices';
import { buildMainQueueOptions, rabbitMqTopology } from './rabbitmq.constants';

/** Nest microservice consumer options — must match publisher queue args. */
export function buildRmqMicroserviceOptions(urls: string[]): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls,
      queue: rabbitMqTopology.queue,
      noAck: false,
      prefetchCount: 10,
      queueOptions: buildMainQueueOptions(),
    },
  };
}

/** Nest ClientProxy publisher options — persistent + same queue args. */
export function buildRmqClientOptions(url: string): RmqOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [url],
      queue: rabbitMqTopology.queue,
      persistent: true,
      queueOptions: buildMainQueueOptions(),
    },
  };
}
