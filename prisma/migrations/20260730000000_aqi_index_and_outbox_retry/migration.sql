-- Enrich alerts with index metadata (LAQI vs UAQI fallback)
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "index_code" TEXT NOT NULL DEFAULT 'usa_epa';
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "scale_direction" TEXT NOT NULL DEFAULT 'higher_is_worse';
ALTER TABLE "alerts" ADD COLUMN IF NOT EXISTS "uaqi" INTEGER;

-- Outbox retry / terminal failure support
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "next_attempt_at" TIMESTAMP(3);
ALTER TABLE "outbox_messages" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "outbox_messages_published_at_failed_at_next_attempt_at_idx"
  ON "outbox_messages"("published_at", "failed_at", "next_attempt_at");
