import { Controller, Get, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';
import { AlertResponseDto } from './dto/alert-response.dto';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  async getAlerts(@Query('limit') limit?: string): Promise<AlertResponseDto[]> {
    return this.alertsService.getRecentAlerts(this.parseLimit(limit));
  }

  private parseLimit(limit?: string): number {
    if (limit === undefined || limit.trim() === '') {
      return 20;
    }
    const parsed = Number(limit);
    if (!Number.isFinite(parsed)) {
      return 20;
    }
    return Math.min(Math.max(Math.trunc(parsed), 1), 20);
  }
}
