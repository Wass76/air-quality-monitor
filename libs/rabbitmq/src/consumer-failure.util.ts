import { rabbitMqTopology } from './rabbitmq.constants';

export type FailureClass = 'validation' | 'transient' | 'exhausted';

export interface AmqpDeathHeader {
  queue?: string;
  count?: number;
}

export interface AmqpLikeMessage {
  properties?: {
    headers?: Record<string, unknown>;
  };
}

export function deliveryAttemptCount(
  msg: AmqpLikeMessage,
  mainQueue = rabbitMqTopology.queue,
): number {
  const headers = msg.properties?.headers ?? {};
  const deaths = headers['x-death'];
  if (!Array.isArray(deaths) || deaths.length === 0) {
    return 0;
  }
  const mainDeath = deaths.find(
    (d): d is AmqpDeathHeader =>
      typeof d === 'object' &&
      d !== null &&
      (d as AmqpDeathHeader).queue === mainQueue,
  );
  if (typeof mainDeath?.count === 'number') {
    return mainDeath.count;
  }
  const first = deaths[0] as AmqpDeathHeader | undefined;
  return typeof first?.count === 'number' ? first.count : 0;
}

export function isValidationError(error: unknown): boolean {
  if (Array.isArray(error)) {
    // class-validator validateOrReject rejects with ValidationError[]
    return error.length > 0 && error.every(isClassValidatorError);
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'ValidationError' ||
    error.message.toLowerCase().includes('validation')
  );
}

function isClassValidatorError(item: unknown): boolean {
  if (typeof item !== 'object' || item === null) {
    return false;
  }
  const record = item as Record<string, unknown>;
  return (
    typeof record.property === 'string' ||
    record.constraints !== undefined ||
    record.children !== undefined
  );
}

export function classifyFailure(
  error: unknown,
  attempts: number,
  maxAttempts = rabbitMqTopology.maxDeliveryAttempts,
): FailureClass {
  if (isValidationError(error)) {
    return 'validation';
  }
  if (attempts + 1 >= maxAttempts) {
    return 'exhausted';
  }
  return 'transient';
}

export function shouldMoveToDlq(failure: FailureClass): boolean {
  return failure === 'validation' || failure === 'exhausted';
}
