import { MonitoredCity, ScaleDirection, rgbToHex } from '@app/common';
import {
  GoogleAirQualityIndex,
  GoogleAirQualityResponse,
  MappedAirQualityReading,
} from './google-aqi.types';

const MICROGRAMS_PER_CUBIC_METER = 'MICROGRAMS_PER_CUBIC_METER';

export type MapperLogger = {
  warn(message: string): void;
};

export function mapGoogleAirQualityResponse(
  city: MonitoredCity,
  data: GoogleAirQualityResponse,
  localAqiCode: string,
  logger?: MapperLogger,
): MappedAirQualityReading {
  const indexes = data.indexes ?? [];
  const uaqiIndex = indexes.find((i) => i.code?.toLowerCase() === 'uaqi');
  const uaqi = typeof uaqiIndex?.aqi === 'number' ? uaqiIndex.aqi : null;

  const primary = selectPrimaryIndex(
    city.name,
    indexes,
    uaqiIndex,
    localAqiCode,
    logger,
  );
  if (!primary.index || typeof primary.index.aqi !== 'number') {
    throw new Error(
      `Missing usable AQI index for ${city.name} (no local AQI and no UAQI)`,
    );
  }

  return {
    city: city.name,
    regionCode: city.regionCode,
    latitude: city.latitude,
    longitude: city.longitude,
    aqi: primary.index.aqi,
    indexCode: primary.indexCode,
    scaleDirection: primary.scaleDirection,
    uaqi,
    category: primary.index.category ?? 'Unknown',
    dominantPollutant: primary.index.dominantPollutant ?? 'unknown',
    colorHex: rgbToHex(primary.index.color),
    pm25: findPollutantUgPerM3(data, 'pm25', logger),
    pm10: findPollutantUgPerM3(data, 'pm10', logger),
    observedAt: data.dateTime ?? new Date().toISOString(),
  };
}

export function selectPrimaryIndex(
  cityName: string,
  indexes: GoogleAirQualityIndex[],
  uaqiIndex: GoogleAirQualityIndex | undefined,
  localAqiCode: string,
  logger?: MapperLogger,
): {
  index: GoogleAirQualityIndex | undefined;
  indexCode: string;
  scaleDirection: ScaleDirection;
} {
  const preferred = indexes.find((i) => i.code?.toLowerCase() === localAqiCode);
  if (preferred && typeof preferred.aqi === 'number') {
    return {
      index: preferred,
      indexCode: preferred.code?.toLowerCase() ?? localAqiCode,
      scaleDirection: 'higher_is_worse',
    };
  }

  const anyLocal = indexes.find(
    (i) => i.code?.toLowerCase() !== 'uaqi' && typeof i.aqi === 'number',
  );
  if (anyLocal) {
    logger?.warn(
      `Configured LAQI "${localAqiCode}" missing for ${cityName}; using local index "${anyLocal.code}"`,
    );
    return {
      index: anyLocal,
      indexCode: anyLocal.code?.toLowerCase() ?? 'local',
      scaleDirection: 'higher_is_worse',
    };
  }

  logger?.warn(
    `No local AQI for ${cityName}; falling back to UAQI (lower-is-worse)`,
  );
  return {
    index: uaqiIndex,
    indexCode: 'uaqi',
    scaleDirection: 'lower_is_worse',
  };
}

export function findPollutantUgPerM3(
  data: GoogleAirQualityResponse,
  code: string,
  logger?: MapperLogger,
): number | null {
  const pollutant = data.pollutants?.find(
    (p) => p.code?.toLowerCase() === code.toLowerCase(),
  );
  const concentration = pollutant?.concentration;
  if (typeof concentration?.value !== 'number') {
    return null;
  }
  const units = concentration.units?.toUpperCase();
  if (units && units !== MICROGRAMS_PER_CUBIC_METER) {
    logger?.warn(
      `Ignoring pollutant ${code}: unexpected units "${concentration.units}" (expected ${MICROGRAMS_PER_CUBIC_METER})`,
    );
    return null;
  }
  return concentration.value;
}
