import { validateCollectorEnv, validateProcessorEnv } from './env.validation';

describe('env.validation', () => {
  const baseCollector = {
    DATABASE_URL: 'postgresql://aqi:aqi@localhost:5432/air_quality',
    RABBITMQ_URL: 'amqp://aqi:aqi@localhost:5672',
  };

  it('accepts mock provider without Google API key', () => {
    expect(() =>
      validateCollectorEnv({ ...baseCollector, AQI_PROVIDER: 'mock' }),
    ).not.toThrow();
  });

  it('requires Google API key for google provider', () => {
    expect(() =>
      validateCollectorEnv({ ...baseCollector, AQI_PROVIDER: 'google' }),
    ).toThrow(/GOOGLE_AQI_API_KEY/);
  });

  it('accepts google provider with API key', () => {
    expect(() =>
      validateCollectorEnv({
        ...baseCollector,
        AQI_PROVIDER: 'google',
        GOOGLE_AQI_API_KEY: 'test-key',
      }),
    ).not.toThrow();
  });

  it('rejects invalid provider', () => {
    expect(() =>
      validateCollectorEnv({ ...baseCollector, AQI_PROVIDER: 'yahoo' }),
    ).toThrow(/AQI_PROVIDER/);
  });

  it('rejects out-of-range poll interval', () => {
    expect(() =>
      validateCollectorEnv({
        ...baseCollector,
        AQI_PROVIDER: 'mock',
        POLL_INTERVAL_MS: '10',
      }),
    ).toThrow(/POLL_INTERVAL_MS/);
  });

  it('rejects fractional batch size', () => {
    expect(() =>
      validateCollectorEnv({
        ...baseCollector,
        AQI_PROVIDER: 'mock',
        OUTBOX_BATCH_SIZE: '1.5',
      }),
    ).toThrow(/OUTBOX_BATCH_SIZE/);
  });

  it('requires processor database and rabbit urls', () => {
    expect(() => validateProcessorEnv({})).toThrow(/DATABASE_URL/);
    expect(() =>
      validateProcessorEnv({ DATABASE_URL: baseCollector.DATABASE_URL }),
    ).toThrow(/RABBITMQ_URL/);
  });
});
