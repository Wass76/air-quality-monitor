import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AlertPublicDto } from '@app/common';
import { AppLoggerService } from '@app/logger';

@WebSocketGateway({
  cors: { origin: '*' },
  path: '/alerts-ws',
})
export class AlertsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger: AppLoggerService;

  constructor(logger: AppLoggerService) {
    this.logger = logger;
    this.logger.setContext(AlertsGateway.name);
  }

  handleConnection(client: Socket): void {
    this.logger.debug(`WebSocket client connected: ${client.id}`);
  }

  broadcastAlert(alert: AlertPublicDto): void {
    this.server?.emit('alert', alert);
  }
}
