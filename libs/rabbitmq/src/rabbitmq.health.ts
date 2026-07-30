import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { RabbitMqTopologyService } from './rabbitmq-topology.service';

@Injectable()
export class RabbitMqHealthIndicator extends HealthIndicator {
  constructor(private readonly topology: RabbitMqTopologyService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const topologyOk = await this.topology.isReady();
    const result = this.getStatus(key, topologyOk, {
      status: topologyOk ? 'up' : 'down',
      topology: topologyOk ? 'up' : 'down',
    });
    if (topologyOk) {
      return result;
    }
    throw new HealthCheckError('RabbitMQ check failed', result);
  }
}
