import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ArrayNotEmpty,
  ValidateIf,
} from 'class-validator';

export class AirQualityAlertEventDto {
  @IsUUID()
  eventId!: string;

  @IsString()
  city!: string;

  @IsString()
  regionCode!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsNumber()
  aqi!: number;

  @IsString()
  indexCode!: string;

  @IsIn(['higher_is_worse', 'lower_is_worse'])
  scaleDirection!: 'higher_is_worse' | 'lower_is_worse';

  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  uaqi!: number | null;

  @IsString()
  category!: string;

  @IsString()
  dominantPollutant!: string;

  @IsString()
  colorHex!: string;

  @IsOptional()
  @IsNumber()
  pm25!: number | null;

  @IsOptional()
  @IsNumber()
  pm10!: number | null;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  triggeredBy!: string[];

  @IsISO8601()
  observedAt!: string;

  @IsISO8601()
  publishedAt!: string;
}
