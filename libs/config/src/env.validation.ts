import { plainToInstance } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function requireNonEmpty(
  config: Record<string, unknown>,
  key: string,
  errors: string[],
): void {
  const value = asString(config[key]).trim();
  if (value === '') {
    errors.push(`  - ${key}: must be a non-empty string`);
  }
}

function assertPositiveInt(
  config: Record<string, unknown>,
  key: string,
  errors: string[],
  options?: { min?: number; max?: number },
): void {
  const raw = config[key];
  if (raw === undefined || raw === null || asString(raw).trim() === '') {
    return;
  }
  const parsed = Number(asString(raw));
  const min = options?.min ?? 1;
  const max = options?.max;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    errors.push(`  - ${key}: must be an integer >= ${min}`);
    return;
  }
  if (max !== undefined && parsed > max) {
    errors.push(`  - ${key}: must be an integer <= ${max}`);
  }
}

function assertValid(validated: object, requiredErrors: string[]): void {
  const errors = validateSync(validated, {
    skipMissingProperties: true,
    whitelist: false,
    forbidNonWhitelisted: false,
  });

  const constraintErrors = errors
    .filter((e) => e.constraints)
    .map((e) => {
      const constraints = Object.values(e.constraints!).join(', ');
      return `  - ${e.property}: ${constraints}`;
    });

  const all = [...requiredErrors, ...constraintErrors];
  if (all.length > 0) {
    throw new Error(`Environment validation failed:\n${all.join('\n')}`);
  }
}

/** Env schema for the Data Collector service. */
class CollectorEnvironment {
  @IsOptional()
  @IsString()
  AQI_PROVIDER?: string;

  @IsOptional()
  @IsString()
  GOOGLE_AQI_API_KEY?: string;

  @IsOptional()
  @IsString()
  MOCK_CRITICAL_CITIES?: string;

  @IsOptional()
  @IsString()
  LOCAL_AQI_CODE?: string;

  @IsOptional()
  @IsString()
  UAQI_CRITICAL_FLOOR?: string;

  @IsOptional()
  @IsString()
  LAQI_RECOVERY?: string;

  @IsOptional()
  @IsString()
  UAQI_RECOVERY_FLOOR?: string;

  @IsOptional()
  @IsString()
  PM25_RECOVERY?: string;

  @IsOptional()
  @IsString()
  PM10_RECOVERY?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL!: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  POLL_INTERVAL_MS?: string;

  @IsOptional()
  @IsString()
  ALERT_COOLDOWN_MS?: string;

  @IsOptional()
  @IsString()
  OUTBOX_RELAY_INTERVAL_MS?: string;

  @IsOptional()
  @IsString()
  OUTBOX_BATCH_SIZE?: string;

  @IsOptional()
  @IsString()
  LOG_TO_FILE?: string;
}

/** Env schema for the Alert Processor service. */
class ProcessorEnvironment {
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL!: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  LOG_TO_FILE?: string;
}

export function validateCollectorEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(CollectorEnvironment, config, {
    enableImplicitConversion: true,
  });
  const required: string[] = [];
  requireNonEmpty(config, 'DATABASE_URL', required);
  requireNonEmpty(config, 'RABBITMQ_URL', required);

  const provider = asString(config.AQI_PROVIDER ?? 'google')
    .trim()
    .toLowerCase();
  if (provider !== 'mock' && provider !== 'google') {
    required.push('  - AQI_PROVIDER: must be "google" or "mock"');
  }
  if (provider === 'google') {
    requireNonEmpty(config, 'GOOGLE_AQI_API_KEY', required);
  }

  assertPositiveInt(config, 'POLL_INTERVAL_MS', required, { min: 1000 });
  assertPositiveInt(config, 'ALERT_COOLDOWN_MS', required, { min: 0 });
  assertPositiveInt(config, 'OUTBOX_RELAY_INTERVAL_MS', required, {
    min: 100,
  });
  assertPositiveInt(config, 'OUTBOX_BATCH_SIZE', required, {
    min: 1,
    max: 500,
  });
  assertPositiveInt(config, 'UAQI_CRITICAL_FLOOR', required, {
    min: 0,
    max: 100,
  });
  assertPositiveInt(config, 'LAQI_RECOVERY', required, { min: 0, max: 500 });
  assertPositiveInt(config, 'UAQI_RECOVERY_FLOOR', required, {
    min: 0,
    max: 100,
  });
  assertPositiveInt(config, 'PM25_RECOVERY', required, { min: 0 });
  assertPositiveInt(config, 'PM10_RECOVERY', required, { min: 0 });
  assertPositiveInt(config, 'PORT', required, { min: 1, max: 65535 });

  assertValid(validated, required);
  return config;
}

export function validateProcessorEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const validated = plainToInstance(ProcessorEnvironment, config, {
    enableImplicitConversion: true,
  });
  const required: string[] = [];
  requireNonEmpty(config, 'DATABASE_URL', required);
  requireNonEmpty(config, 'RABBITMQ_URL', required);
  assertPositiveInt(config, 'PORT', required, { min: 1, max: 65535 });
  assertValid(validated, required);
  return config;
}
