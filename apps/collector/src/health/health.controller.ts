import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { RabbitMqHealthIndicator } from '@app/rabbitmq';
import { PrismaHealthIndicator } from './prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaHealthIndicator,
    private readonly rabbit: RabbitMqHealthIndicator,
  ) {}

  /** Liveness: process is up. Used by Compose healthchecks. */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
    ]);
  }

  /** Readiness: dependencies must be reachable. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      () => this.prisma.isHealthy('database'),
      () => this.rabbit.isHealthy('rabbitmq'),
    ]);
  }

  /** Alias for ready (backward compatible). */
  @Get()
  @HealthCheck()
  check() {
    return this.ready();
  }
}
