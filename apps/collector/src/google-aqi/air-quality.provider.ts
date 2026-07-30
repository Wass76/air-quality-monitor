import { MonitoredCity } from '@app/common';
import { MappedAirQualityReading } from './google-aqi.types';

export const AIR_QUALITY_PROVIDER = 'AIR_QUALITY_PROVIDER';

export interface AirQualityProvider {
  fetchCurrentConditions(city: MonitoredCity): Promise<MappedAirQualityReading>;
}
