import {
  classifyFailure,
  deliveryAttemptCount,
  isValidationError,
  shouldMoveToDlq,
} from './consumer-failure.util';
import { rabbitMqTopology } from './rabbitmq.constants';

describe('consumer-failure.util', () => {
  it('counts delivery attempts from x-death on main queue', () => {
    const attempts = deliveryAttemptCount({
      properties: {
        headers: {
          'x-death': [
            { queue: rabbitMqTopology.retryQueue, count: 9 },
            { queue: rabbitMqTopology.queue, count: 2 },
          ],
        },
      },
    });
    expect(attempts).toBe(2);
  });

  it('returns 0 when x-death is missing', () => {
    expect(deliveryAttemptCount({ properties: { headers: {} } })).toBe(0);
  });

  it('detects class-validator rejection arrays', () => {
    expect(
      isValidationError([
        { property: 'eventId', constraints: { isUuid: 'x' } },
      ]),
    ).toBe(true);
    expect(isValidationError([{ foo: 1 }])).toBe(false);
  });

  it('classifies validation and exhausted failures for DLQ', () => {
    expect(classifyFailure(new Error('validation failed'), 0)).toBe(
      'validation',
    );
    expect(
      classifyFailure(
        new Error('db down'),
        rabbitMqTopology.maxDeliveryAttempts,
      ),
    ).toBe('exhausted');
    expect(classifyFailure(new Error('db down'), 0)).toBe('transient');
    expect(shouldMoveToDlq('validation')).toBe(true);
    expect(shouldMoveToDlq('transient')).toBe(false);
  });
});
