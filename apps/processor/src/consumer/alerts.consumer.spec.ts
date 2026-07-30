import { AlertsConsumer } from './alerts.consumer';
import { AlertsService } from '../alerts/alerts.service';
import { RabbitMqTopologyService } from '@app/rabbitmq';
import { AppLoggerService } from '@app/logger';
import { RmqContext } from '@nestjs/microservices';

function makeContext(headers: Record<string, unknown> = {}) {
  const msg = {
    content: Buffer.from('{}'),
    properties: { headers },
  };
  const channel = {
    ack: jest.fn(),
    nack: jest.fn(),
  };
  const context = {
    getChannelRef: () => channel,
    getMessage: () => msg,
  } as unknown as RmqContext;
  return { context, channel, msg };
}

describe('AlertsConsumer', () => {
  const processIncoming = jest.fn();
  const publishToDlq = jest.fn();
  const logger = {
    setContext: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  function buildConsumer() {
    return new AlertsConsumer(
      { processIncoming } as unknown as AlertsService,
      { publishToDlq } as unknown as RabbitMqTopologyService,
      logger as unknown as AppLoggerService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acks successful processing', async () => {
    processIncoming.mockResolvedValue({});
    const consumer = buildConsumer();
    const { context, channel } = makeContext();
    await consumer.handleAlert({}, context);
    expect(channel.ack).toHaveBeenCalled();
  });

  it('moves validation failures to DLQ and acks', async () => {
    processIncoming.mockRejectedValue([
      { property: 'eventId', constraints: { isUuid: 'bad' } },
    ]);
    publishToDlq.mockResolvedValue(undefined);
    const consumer = buildConsumer();
    const { context, channel } = makeContext();
    await consumer.handleAlert({}, context);
    expect(publishToDlq).toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalled();
  });

  it('nacks without requeue when DLQ publish fails for validation', async () => {
    processIncoming.mockRejectedValue(new Error('validation failed'));
    publishToDlq.mockRejectedValue(new Error('dlq down'));
    const consumer = buildConsumer();
    const { context, channel } = makeContext();
    await consumer.handleAlert({}, context);
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
  });

  it('nacks without requeue for transient failures', async () => {
    processIncoming.mockRejectedValue(new Error('db timeout'));
    const consumer = buildConsumer();
    const { context, channel } = makeContext();
    await consumer.handleAlert({}, context);
    expect(channel.nack).toHaveBeenCalledWith(expect.anything(), false, false);
    expect(publishToDlq).not.toHaveBeenCalled();
  });
});
