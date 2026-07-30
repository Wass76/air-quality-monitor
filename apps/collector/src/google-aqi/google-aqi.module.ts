import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppLoggerService } from '@app/logger';
import { AIR_QUALITY_PROVIDER } from './air-quality.provider';
import { GoogleAqiClient } from './google-aqi.client';
import { MockAqiClient } from './mock-aqi.client';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AIR_QUALITY_PROVIDER,
      inject: [ConfigService, AppLoggerService],
      useFactory: (config: ConfigService, logger: AppLoggerService) => {
        const provider = (config.get<string>('AQI_PROVIDER') ?? 'google')
          .trim()
          .toLowerCase();
        if (provider === 'mock') {
          return new MockAqiClient(config, logger);
        }
        return new GoogleAqiClient(config, logger);
      },
    },
  ],
  exports: [AIR_QUALITY_PROVIDER],
})
export class GoogleAqiModule {}
