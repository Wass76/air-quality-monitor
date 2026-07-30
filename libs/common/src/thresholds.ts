/**
 * Critical thresholds for alert evaluation with hysteresis bands.
 *
 * Local AQI (e.g. usa_epa) uses higher-is-worse (0–500).
 * Universal AQI fallback uses lower-is-worse (0–100).
 * An alert is warranted when ANY applicable enter threshold is crossed.
 * Recovery requires every applicable signal to pass its exit threshold.
 */
export const AIR_QUALITY_THRESHOLDS = {
  LAQI: 100,
  LAQI_RECOVERY: 90,
  UAQI_FLOOR: 40,
  UAQI_RECOVERY: 50,
  PM25: 100,
  PM25_RECOVERY: 90,
  PM10: 150,
  PM10_RECOVERY: 135,
} as const;

/** Preferred local AQI code forced via customLocalAqis for GCC cities. */
export const DEFAULT_LOCAL_AQI_CODE = 'usa_epa';

export type ScaleDirection = 'higher_is_worse' | 'lower_is_worse';

export type TriggerReason = 'LAQI' | 'UAQI_LOW' | 'PM25' | 'PM10';

export type AirQualityState = 'critical' | 'healthy' | 'hold';
