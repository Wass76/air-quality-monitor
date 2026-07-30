import { GoogleRgbColor, ScaleDirection } from '@app/common';
import { CityName, RegionCode } from '@app/common';

export interface GoogleAirQualityIndex {
  code?: string;
  displayName?: string;
  aqi?: number;
  aqiDisplay?: string;
  color?: GoogleRgbColor;
  category?: string;
  dominantPollutant?: string;
}

export interface GooglePollutant {
  code?: string;
  displayName?: string;
  fullName?: string;
  concentration?: {
    value?: number;
    units?: string;
  };
}

export interface GoogleAirQualityResponse {
  dateTime?: string;
  regionCode?: string;
  indexes?: GoogleAirQualityIndex[];
  pollutants?: GooglePollutant[];
}

export interface MappedAirQualityReading {
  city: CityName;
  regionCode: RegionCode;
  latitude: number;
  longitude: number;
  /** Primary AQI used for alerting; meaning depends on indexCode. */
  aqi: number;
  /** Index that produced `aqi` (e.g. usa_epa or uaqi). */
  indexCode: string;
  /** How to interpret `aqi` for the primary index. */
  scaleDirection: ScaleDirection;
  /** Universal AQI for enrichment / UAQI_LOW fallback; never compared to 100. */
  uaqi: number | null;
  category: string;
  dominantPollutant: string;
  colorHex: string;
  pm25: number | null;
  pm10: number | null;
  observedAt: string;
}
