import { ThresholdEvaluator } from './threshold.evaluator';
import { MappedAirQualityReading } from '../google-aqi/google-aqi.types';

function reading(
  overrides: Partial<MappedAirQualityReading> = {},
): MappedAirQualityReading {
  return {
    city: 'Dubai',
    regionCode: 'AE',
    latitude: 25.2,
    longitude: 55.2,
    aqi: 45,
    indexCode: 'usa_epa',
    scaleDirection: 'higher_is_worse',
    uaqi: 70,
    category: 'Moderate',
    dominantPollutant: 'pm25',
    colorHex: '#00FF00',
    pm25: 20,
    pm10: 40,
    observedAt: '2025-11-02T08:00:00Z',
    ...overrides,
  };
}

describe('ThresholdEvaluator', () => {
  const evaluator = new ThresholdEvaluator({
    get: () => undefined,
  } as never);

  it('reports healthy when LAQI and PM are below recovery thresholds', () => {
    const result = evaluator.evaluate(reading());
    expect(result.state).toBe('healthy');
    expect(result.exceeded).toBe(false);
    expect(result.triggeredBy).toEqual([]);
  });

  it('does not trigger LAQI at exactly 100 (hold band)', () => {
    const result = evaluator.evaluate(reading({ aqi: 100 }));
    expect(result.state).toBe('hold');
    expect(result.triggeredBy).not.toContain('LAQI');
  });

  it('holds LAQI at 99 between recovery and enter', () => {
    const result = evaluator.evaluate(reading({ aqi: 99 }));
    expect(result.state).toBe('hold');
    expect(result.exceeded).toBe(false);
  });

  it('recovers LAQI at 90', () => {
    const result = evaluator.evaluate(reading({ aqi: 90 }));
    expect(result.state).toBe('healthy');
  });

  it('triggers LAQI at 101', () => {
    const result = evaluator.evaluate(reading({ aqi: 101 }));
    expect(result.state).toBe('critical');
    expect(result.exceeded).toBe(true);
    expect(result.triggeredBy).toContain('LAQI');
  });

  it('triggers LAQI at 180 (assignment-style Unhealthy)', () => {
    const result = evaluator.evaluate(reading({ aqi: 180 }));
    expect(result.triggeredBy).toContain('LAQI');
  });

  it('triggers UAQI_LOW when fallback scale and uaqi < 40', () => {
    const result = evaluator.evaluate(
      reading({
        aqi: 25,
        indexCode: 'uaqi',
        scaleDirection: 'lower_is_worse',
        uaqi: 25,
      }),
    );
    expect(result.state).toBe('critical');
    expect(result.triggeredBy).toContain('UAQI_LOW');
  });

  it('holds UAQI at floor 40', () => {
    const result = evaluator.evaluate(
      reading({
        aqi: 40,
        indexCode: 'uaqi',
        scaleDirection: 'lower_is_worse',
        uaqi: 40,
        pm25: null,
        pm10: null,
      }),
    );
    expect(result.state).toBe('hold');
    expect(result.exceeded).toBe(false);
  });

  it('holds UAQI at 45 between enter and recovery', () => {
    const result = evaluator.evaluate(
      reading({
        aqi: 45,
        indexCode: 'uaqi',
        scaleDirection: 'lower_is_worse',
        uaqi: 45,
        pm25: null,
        pm10: null,
      }),
    );
    expect(result.state).toBe('hold');
  });

  it('recovers UAQI at 50', () => {
    const result = evaluator.evaluate(
      reading({
        aqi: 50,
        indexCode: 'uaqi',
        scaleDirection: 'lower_is_worse',
        uaqi: 50,
        pm25: null,
        pm10: null,
      }),
    );
    expect(result.state).toBe('healthy');
  });

  it('triggers UAQI_LOW at 39', () => {
    const result = evaluator.evaluate(
      reading({
        aqi: 39,
        indexCode: 'uaqi',
        scaleDirection: 'lower_is_worse',
        uaqi: 39,
      }),
    );
    expect(result.triggeredBy).toContain('UAQI_LOW');
  });

  it('triggers on PM2.5 > 100', () => {
    const result = evaluator.evaluate(reading({ pm25: 172.4 }));
    expect(result.state).toBe('critical');
    expect(result.triggeredBy).toContain('PM25');
  });

  it('holds PM2.5 in grey band', () => {
    const result = evaluator.evaluate(reading({ aqi: 50, pm25: 95 }));
    expect(result.state).toBe('hold');
  });

  it('triggers on PM10 > 150', () => {
    const result = evaluator.evaluate(reading({ pm10: 205.8 }));
    expect(result.state).toBe('critical');
    expect(result.triggeredBy).toContain('PM10');
  });

  it('treats null pollutants as not blocking recovery', () => {
    const result = evaluator.evaluate(
      reading({ aqi: 50, pm25: null, pm10: null }),
    );
    expect(result.state).toBe('healthy');
  });

  it('can trigger multiple reasons together for LAQI', () => {
    const result = evaluator.evaluate(
      reading({ aqi: 180, pm25: 172, pm10: 205 }),
    );
    expect(result.triggeredBy).toEqual(
      expect.arrayContaining(['LAQI', 'PM25', 'PM10']),
    );
  });

  it('models LAQI flap 101→99→101 as critical/hold/critical', () => {
    expect(evaluator.evaluate(reading({ aqi: 101 })).state).toBe('critical');
    expect(evaluator.evaluate(reading({ aqi: 99 })).state).toBe('hold');
    expect(evaluator.evaluate(reading({ aqi: 101 })).state).toBe('critical');
  });

  it('models LAQI recovery 101→90→101 as critical/healthy/critical', () => {
    expect(evaluator.evaluate(reading({ aqi: 101 })).state).toBe('critical');
    expect(evaluator.evaluate(reading({ aqi: 90 })).state).toBe('healthy');
    expect(evaluator.evaluate(reading({ aqi: 101 })).state).toBe('critical');
  });

  it('models UAQI flap 39→45→39 as critical/hold/critical', () => {
    const base = {
      indexCode: 'uaqi' as const,
      scaleDirection: 'lower_is_worse' as const,
      pm25: null,
      pm10: null,
    };
    expect(
      evaluator.evaluate(reading({ ...base, aqi: 39, uaqi: 39 })).state,
    ).toBe('critical');
    expect(
      evaluator.evaluate(reading({ ...base, aqi: 45, uaqi: 45 })).state,
    ).toBe('hold');
    expect(
      evaluator.evaluate(reading({ ...base, aqi: 39, uaqi: 39 })).state,
    ).toBe('critical');
  });
});
