import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CityName, DEFAULT_LOCAL_AQI_CODE, MonitoredCity } from '@app/common';
import { AppLoggerService } from '@app/logger';
import { AirQualityProvider } from './air-quality.provider';
import { MappedAirQualityReading } from './google-aqi.types';

/**
 * Deterministic mock provider for local demos without Google billing.
 *
 * - Riyadh / Dubai / Doha: usa_epa-style LAQI (0–500, higher-is-worse)
 * - Muscat: UAQI-only fallback (0–100, lower-is-worse) to exercise OM coverage gap
 *
 * Cities listed in MOCK_CRITICAL_CITIES exceed thresholds so the full
 * alert pipeline (dedup → RabbitMQ → processor) can be exercised.
 */
@Injectable()
export class MockAqiClient implements AirQualityProvider {
  private readonly criticalCities: Set<CityName>;
  private readonly logger: AppLoggerService;
  private tick = 0;

  constructor(config: ConfigService, logger: AppLoggerService) {
    this.logger = logger;
    this.logger.setContext(MockAqiClient.name);

    const raw = config.get<string>('MOCK_CRITICAL_CITIES') ?? 'Dubai,Doha';
    this.criticalCities = new Set(
      raw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean) as CityName[],
    );

    this.logger.warn(
      `Using MOCK air-quality provider. Critical cities: ${[...this.criticalCities].join(', ') || '(none)'}`,
    );
  }

  fetchCurrentConditions(
    city: MonitoredCity,
  ): Promise<MappedAirQualityReading> {
    this.tick += 1;
    const critical = this.criticalCities.has(city.name);
    const jitter = (this.tick + city.name.length) % 7;

    // Muscat simulates Google coverage gap for OM: no local AQI, UAQI only.
    if (city.name === 'Muscat') {
      return Promise.resolve(this.muscatReading(city, critical, jitter));
    }

    return Promise.resolve(this.laqiReading(city, critical, jitter));
  }

  private laqiReading(
    city: MonitoredCity,
    critical: boolean,
    jitter: number,
  ): MappedAirQualityReading {
    if (critical) {
      return {
        city: city.name,
        regionCode: city.regionCode,
        latitude: city.latitude,
        longitude: city.longitude,
        aqi: 160 + jitter,
        indexCode: DEFAULT_LOCAL_AQI_CODE,
        scaleDirection: 'higher_is_worse',
        uaqi: 25 + (jitter % 5),
        category: 'Unhealthy',
        dominantPollutant: 'pm25',
        colorHex: '#FF0000',
        pm25: 150 + jitter,
        pm10: 180 + jitter,
        observedAt: new Date().toISOString(),
      };
    }

    return {
      city: city.name,
      regionCode: city.regionCode,
      latitude: city.latitude,
      longitude: city.longitude,
      aqi: 45 + jitter,
      indexCode: DEFAULT_LOCAL_AQI_CODE,
      scaleDirection: 'higher_is_worse',
      uaqi: 70 + (jitter % 10),
      category: 'Moderate',
      dominantPollutant: 'o3',
      colorHex: '#FFFF00',
      pm25: 20 + jitter,
      pm10: 35 + jitter,
      observedAt: new Date().toISOString(),
    };
  }

  private muscatReading(
    city: MonitoredCity,
    critical: boolean,
    jitter: number,
  ): MappedAirQualityReading {
    // UAQI: 0–100, lower is worse. Critical when below floor (default 40).
    if (critical) {
      return {
        city: city.name,
        regionCode: city.regionCode,
        latitude: city.latitude,
        longitude: city.longitude,
        aqi: 18 + (jitter % 10),
        indexCode: 'uaqi',
        scaleDirection: 'lower_is_worse',
        uaqi: 18 + (jitter % 10),
        category: 'Poor air quality',
        dominantPollutant: 'pm25',
        colorHex: '#FF0000',
        pm25: 150 + jitter,
        pm10: 180 + jitter,
        observedAt: new Date().toISOString(),
      };
    }

    return {
      city: city.name,
      regionCode: city.regionCode,
      latitude: city.latitude,
      longitude: city.longitude,
      aqi: 65 + (jitter % 10),
      indexCode: 'uaqi',
      scaleDirection: 'lower_is_worse',
      uaqi: 65 + (jitter % 10),
      category: 'Good air quality',
      dominantPollutant: 'o3',
      colorHex: '#84CF33',
      pm25: 20 + jitter,
      pm10: 35 + jitter,
      observedAt: new Date().toISOString(),
    };
  }
}
