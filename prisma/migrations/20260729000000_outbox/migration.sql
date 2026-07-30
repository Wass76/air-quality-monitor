-- Transactional outbox + durable per-city dedup state
CREATE TABLE IF NOT EXISTS "outbox_messages" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" VARCHAR(1000),
    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_messages_event_id_key" ON "outbox_messages"("event_id");
CREATE INDEX "outbox_messages_published_at_created_at_idx" ON "outbox_messages"("published_at", "created_at");

CREATE TABLE IF NOT EXISTS "city_alert_states" (
    "city" TEXT NOT NULL,
    "was_exceeding" BOOLEAN NOT NULL,
    "last_published_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "city_alert_states_pkey" PRIMARY KEY ("city")
);
