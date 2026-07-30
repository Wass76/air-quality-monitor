import { MONITORED_CITIES } from '@app/common';
import { mapGoogleAirQualityResponse } from './google-aqi.mapper';
import { GoogleAirQualityResponse } from './google-aqi.types';

const dubai = MONITORED_CITIES.find((c) => c.name === 'Dubai')!;
const muscat = MONITORED_CITIES.find((c) => c.name === 'Muscat')!;

describe('mapGoogleAirQualityResponse', () => {
  it('prefers configured usa_epa local index', () => {
    const data: GoogleAirQualityResponse = {
      indexes: [
        { code: 'uaqi', aqi: 70, category: 'Good' },
        {
          code: 'usa_epa',
          aqi: 155,
          category: 'Unhealthy',
          dominantPollutant: 'pm25',
          color: { red: 1, green: 0, blue: 0 },
        },
      ],
      pollutants: [
        {
          code: 'pm25',
          concentration: {
            value: 120,
            units: 'MICROGRAMS_PER_CUBIC_METER',
          },
        },
      ],
      dateTime: '2026-07-30T06:00:00Z',
    };

    const mapped = mapGoogleAirQualityResponse(dubai, data, 'usa_epa');
    expect(mapped.indexCode).toBe('usa_epa');
    expect(mapped.scaleDirection).toBe('higher_is_worse');
    expect(mapped.aqi).toBe(155);
    expect(mapped.uaqi).toBe(70);
    expect(mapped.pm25).toBe(120);
  });

  it('falls back to any local index when preferred is missing', () => {
    const mapped = mapGoogleAirQualityResponse(
      dubai,
      {
        indexes: [
          { code: 'uaqi', aqi: 60 },
          { code: 'deu_uba', aqi: 88, category: 'Moderate' },
        ],
      },
      'usa_epa',
      { warn: jest.fn() },
    );
    expect(mapped.indexCode).toBe('deu_uba');
    expect(mapped.scaleDirection).toBe('higher_is_worse');
    expect(mapped.aqi).toBe(88);
  });

  it('falls back to UAQI lower-is-worse when no local index exists', () => {
    const mapped = mapGoogleAirQualityResponse(
      muscat,
      {
        indexes: [{ code: 'uaqi', aqi: 22, category: 'Poor' }],
      },
      'usa_epa',
      { warn: jest.fn() },
    );
    expect(mapped.indexCode).toBe('uaqi');
    expect(mapped.scaleDirection).toBe('lower_is_worse');
    expect(mapped.aqi).toBe(22);
    expect(mapped.uaqi).toBe(22);
  });

  it('ignores pollutant concentrations with unexpected units', () => {
    const mapped = mapGoogleAirQualityResponse(
      dubai,
      {
        indexes: [{ code: 'usa_epa', aqi: 50 }],
        pollutants: [
          {
            code: 'pm10',
            concentration: { value: 40, units: 'PARTS_PER_BILLION' },
          },
        ],
      },
      'usa_epa',
      { warn: jest.fn() },
    );
    expect(mapped.pm10).toBeNull();
  });

  it('throws when no usable index exists', () => {
    expect(() =>
      mapGoogleAirQualityResponse(dubai, { indexes: [] }, 'usa_epa'),
    ).toThrow(/Missing usable AQI index/);
  });
});
