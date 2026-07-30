import { CityName, RegionCode } from './cities';
import { ScaleDirection, TriggerReason } from './thresholds';

/**
 * Canonical alert event published to RabbitMQ and consumed by the processor.
 * Richer than the public REST shape so logging/persistence need no re-fetch.
 */
export interface AirQualityAlertEvent {
  eventId: string;
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
  /** Universal AQI for enrichment only; never compared to 100. */
  uaqi: number | null;
  category: string;
  dominantPollutant: string;
  colorHex: string;
  pm25: number | null;
  pm10: number | null;
  triggeredBy: TriggerReason[];
  observedAt: string;
  publishedAt: string;
}

/** Public REST / WebSocket payload (assignment contract). */
export interface AlertPublicDto {
  city: string;
  aqi: number;
  category: string;
  timestamp: string;
}

export function toAlertPublicDto(event: AirQualityAlertEvent): AlertPublicDto {
  return {
    city: event.city,
    aqi: event.aqi,
    category: event.category,
    timestamp: event.observedAt,
  };
}
