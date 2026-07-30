/** Shared RabbitMQ pattern / routing keys used by collector and processor. */
export const ALERT_CREATED_PATTERN = 'alert.created';

export const RABBITMQ_QUEUE = 'air_quality.alerts';
export const RABBITMQ_RETRY_QUEUE = 'air_quality.alerts.retry';
export const RABBITMQ_DLQ = 'air_quality.alerts.dlq';
export const RABBITMQ_EXCHANGE = 'air_quality';
export const RABBITMQ_ROUTING_KEY = 'alert.created';

/** Max consumer delivery attempts before moving to DLQ. */
export const RABBITMQ_MAX_DELIVERY_ATTEMPTS = 5;

/** Retry queue TTL before message returns to the main queue (ms). */
export const RABBITMQ_RETRY_TTL_MS = 30_000;
