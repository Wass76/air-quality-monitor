import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AIR_QUALITY_THRESHOLDS,
  AirQualityState,
  TriggerReason,
} from '@app/common';
import { MappedAirQualityReading } from '../google-aqi/google-aqi.types';

export interface ThresholdEvaluation {
  state: AirQualityState;
  /** True when state === 'critical' (enter threshold crossed). */
  exceeded: boolean;
  triggeredBy: TriggerReason[];
}

@Injectable()
export class ThresholdEvaluator {
  private readonly uaqiFloor: number;
  private readonly laqiRecovery: number;
  private readonly uaqiRecovery: number;
  private readonly pm25Recovery: number;
  private readonly pm10Recovery: number;

  constructor(config: ConfigService) {
    this.uaqiFloor = this.readNumber(
      config,
      'UAQI_CRITICAL_FLOOR',
      AIR_QUALITY_THRESHOLDS.UAQI_FLOOR,
    );
    this.laqiRecovery = this.readNumber(
      config,
      'LAQI_RECOVERY',
      AIR_QUALITY_THRESHOLDS.LAQI_RECOVERY,
    );
    this.uaqiRecovery = this.readNumber(
      config,
      'UAQI_RECOVERY_FLOOR',
      AIR_QUALITY_THRESHOLDS.UAQI_RECOVERY,
    );
    this.pm25Recovery = this.readNumber(
      config,
      'PM25_RECOVERY',
      AIR_QUALITY_THRESHOLDS.PM25_RECOVERY,
    );
    this.pm10Recovery = this.readNumber(
      config,
      'PM10_RECOVERY',
      AIR_QUALITY_THRESHOLDS.PM10_RECOVERY,
    );
  }

  evaluate(reading: MappedAirQualityReading): ThresholdEvaluation {
    const triggeredBy: TriggerReason[] = [];
    let primaryCritical = false;
    let primaryHealthy = false;

    if (reading.scaleDirection === 'higher_is_worse') {
      if (reading.aqi > AIR_QUALITY_THRESHOLDS.LAQI) {
        primaryCritical = true;
        triggeredBy.push('LAQI');
      } else if (reading.aqi <= this.laqiRecovery) {
        primaryHealthy = true;
      }
    } else {
      const uaqiValue = reading.uaqi !== null ? reading.uaqi : reading.aqi;
      if (uaqiValue < this.uaqiFloor) {
        primaryCritical = true;
        triggeredBy.push('UAQI_LOW');
      } else if (uaqiValue >= this.uaqiRecovery) {
        primaryHealthy = true;
      }
    }

    let pm25Critical = false;
    let pm25Healthy = true;
    if (reading.pm25 !== null) {
      if (reading.pm25 > AIR_QUALITY_THRESHOLDS.PM25) {
        pm25Critical = true;
        triggeredBy.push('PM25');
      }
      pm25Healthy = reading.pm25 <= this.pm25Recovery;
    }

    let pm10Critical = false;
    let pm10Healthy = true;
    if (reading.pm10 !== null) {
      if (reading.pm10 > AIR_QUALITY_THRESHOLDS.PM10) {
        pm10Critical = true;
        triggeredBy.push('PM10');
      }
      pm10Healthy = reading.pm10 <= this.pm10Recovery;
    }

    if (primaryCritical || pm25Critical || pm10Critical) {
      return { state: 'critical', exceeded: true, triggeredBy };
    }

    if (primaryHealthy && pm25Healthy && pm10Healthy) {
      return { state: 'healthy', exceeded: false, triggeredBy: [] };
    }

    return { state: 'hold', exceeded: false, triggeredBy: [] };
  }

  private readNumber(
    config: ConfigService,
    key: string,
    fallback: number,
  ): number {
    const raw = config.get<string | number>(key);
    if (raw === undefined || raw === null || raw === '') {
      return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
}
