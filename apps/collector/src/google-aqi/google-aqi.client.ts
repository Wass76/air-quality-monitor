import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import { DEFAULT_LOCAL_AQI_CODE, MonitoredCity } from '@app/common';
import { AppLoggerService } from '@app/logger';
import {
  GoogleAirQualityResponse,
  MappedAirQualityReading,
} from './google-aqi.types';
import { mapGoogleAirQualityResponse } from './google-aqi.mapper';

@Injectable()
export class GoogleAqiClient {
  private readonly http: AxiosInstance;
  private readonly logger: AppLoggerService;
  private readonly localAqiCode: string;

  constructor(
    private readonly config: ConfigService,
    logger: AppLoggerService,
  ) {
    this.logger = logger;
    this.logger.setContext(GoogleAqiClient.name);
    const apiKey = this.config.getOrThrow<string>('GOOGLE_AQI_API_KEY');
    this.localAqiCode = (
      this.config.get<string>('LOCAL_AQI_CODE') ?? DEFAULT_LOCAL_AQI_CODE
    )
      .trim()
      .toLowerCase();
    this.http = axios.create({
      baseURL: 'https://airquality.googleapis.com/v1',
      timeout: 8_000,
      params: { key: apiKey },
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async fetchCurrentConditions(
    city: MonitoredCity,
  ): Promise<MappedAirQualityReading> {
    try {
      const { data } = await this.http.post<GoogleAirQualityResponse>(
        '/currentConditions:lookup',
        {
          location: {
            latitude: city.latitude,
            longitude: city.longitude,
          },
          extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
          customLocalAqis: [
            {
              regionCode: city.regionCode.toLowerCase(),
              aqi: this.localAqiCode,
            },
          ],
          // Keep UAQI for Muscat fallback / enrichment — never used as >100 trigger.
          universalAqi: true,
          languageCode: 'en',
        },
      );

      return mapGoogleAirQualityResponse(
        city,
        data,
        this.localAqiCode,
        this.logger,
      );
    } catch (error) {
      throw this.toReadableError(city.name, error);
    }
  }

  private toReadableError(city: string, error: unknown): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{
        error?: { message?: string; status?: string };
      }>;
      const apiMessage =
        axiosError.response?.data?.error?.message ?? axiosError.message;
      const status = axiosError.response?.status;
      return new Error(
        `Google AQI ${status ?? 'error'} for ${city}: ${apiMessage}`,
      );
    }
    return error instanceof Error
      ? error
      : new Error(`Google AQI failed for ${city}: ${String(error)}`);
  }
}
