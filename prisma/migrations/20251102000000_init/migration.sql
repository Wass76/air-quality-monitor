-- CreateSchema
CREATE TABLE IF NOT EXISTS "alerts" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region_code" TEXT NOT NULL,
    "aqi" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "pm25" DOUBLE PRECISION,
    "pm10" DOUBLE PRECISION,
    "dominant_pollutant" TEXT NOT NULL,
    "color_hex" TEXT NOT NULL,
    "triggered_by" TEXT[],
    "observed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alerts_event_id_key" ON "alerts"("event_id");
CREATE INDEX "alerts_observed_at_idx" ON "alerts"("observed_at" DESC);
