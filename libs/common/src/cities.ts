export type CityName = 'Riyadh' | 'Dubai' | 'Doha' | 'Muscat';
export type RegionCode = 'SA' | 'AE' | 'QA' | 'OM';

export interface MonitoredCity {
  name: CityName;
  latitude: number;
  longitude: number;
  regionCode: RegionCode;
  countryCode: RegionCode;
}

export const MONITORED_CITIES: readonly MonitoredCity[] = [
  {
    name: 'Riyadh',
    latitude: 24.7136,
    longitude: 46.6753,
    regionCode: 'SA',
    countryCode: 'SA',
  },
  {
    name: 'Dubai',
    latitude: 25.2048,
    longitude: 55.2708,
    regionCode: 'AE',
    countryCode: 'AE',
  },
  {
    name: 'Doha',
    latitude: 25.2854,
    longitude: 51.531,
    regionCode: 'QA',
    countryCode: 'QA',
  },
  {
    name: 'Muscat',
    latitude: 23.588,
    longitude: 58.3829,
    regionCode: 'OM',
    countryCode: 'OM',
  },
] as const;
