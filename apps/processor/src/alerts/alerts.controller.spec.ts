import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController', () => {
  const getRecentAlerts = jest.fn().mockResolvedValue([]);
  const controller = new AlertsController({
    getRecentAlerts,
  } as unknown as AlertsService);

  beforeEach(() => {
    getRecentAlerts.mockClear();
  });

  it('defaults limit to 20', async () => {
    await controller.getAlerts();
    expect(getRecentAlerts).toHaveBeenCalledWith(20);
  });

  it('clamps above 20', async () => {
    await controller.getAlerts('100');
    expect(getRecentAlerts).toHaveBeenCalledWith(20);
  });

  it('clamps below 1', async () => {
    await controller.getAlerts('0');
    expect(getRecentAlerts).toHaveBeenCalledWith(1);
  });

  it('truncates fractional limits for Prisma take', async () => {
    await controller.getAlerts('1.5');
    expect(getRecentAlerts).toHaveBeenCalledWith(1);
  });

  it('falls back to 20 for invalid values', async () => {
    await controller.getAlerts('abc');
    expect(getRecentAlerts).toHaveBeenCalledWith(20);
  });
});
