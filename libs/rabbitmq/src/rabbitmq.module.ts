import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule } from '@nestjs/microservices';
import { AlertPublisherService } from './alert-publisher.service';
import { RABBITMQ_CLIENT } from './rabbitmq.constants';
import { RabbitMqHealthIndicator } from './rabbitmq.health';
import { RabbitMqTopologyService } from './rabbitmq-topology.service';
import { buildRmqClientOptions } from './rmq-options';

@Global()
@Module({})
export class RabbitMqModule {
  /** Registers an RMQ client for publishing (collector) or health ping (processor). */
  static forRootAsync(): DynamicModule {
    return {
      module: RabbitMqModule,
      imports: [
        ClientsModule.registerAsync([
          {
            name: RABBITMQ_CLIENT,
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) =>
              buildRmqClientOptions(config.getOrThrow<string>('RABBITMQ_URL')),
          },
        ]),
      ],
      providers: [
        RabbitMqTopologyService,
        AlertPublisherService,
        RabbitMqHealthIndicator,
      ],
      exports: [
        AlertPublisherService,
        RabbitMqHealthIndicator,
        RabbitMqTopologyService,
        ClientsModule,
      ],
    };
  }
}
