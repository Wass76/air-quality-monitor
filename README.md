# Air Quality Monitor

Event-driven NestJS monorepo that monitors air quality for **Riyadh, Dubai, Doha, and Muscat**, publishes critical alerts to **RabbitMQ**, and persists/serves them via a **Processor** microservice.

## Architecture

```text
Google Air Quality API (LOCAL_AQI + POLLUTANT_CONCENTRATION)
          │
          ▼
┌─────────────────────┐
│  Collector (:3001)  │  schedule → Google/Mock → threshold → outbox TX → relay → RMQ
└──────────┬──────────┘
           │  air_quality.alerts  (persistent) → retry TTL → DLQ
           ▼
┌─────────────────────┐
│  Processor (:3002)  │  consume → validate → log → Postgres → REST + WebSocket
└─────────────────────┘
```

| App | Responsibility |
|-----|----------------|
| `apps/collector` | Polls AQI every 10s, evaluates thresholds, **transactional outbox** + relay to RabbitMQ |
| `apps/processor` | Hybrid HTTP + RMQ consumer: persists alerts, `GET /alerts`, WebSocket stream, health |
| `libs/common` | Cities, thresholds, alert event contract |
| `libs/config` | Boot-time env validation |
| `libs/logger` | Winston structured logging |
| `libs/rabbitmq` | RMQ client, topology (main/retry/DLQ), health |

## AQI contract (important)

The assignment brief asks for **Universal AQI (UAQI) > 100**. Google’s real UAQI is a **0–100** scale where **higher is better**, so `UAQI > 100` never fires.

This project therefore:

1. Requests **`LOCAL_AQI`** (forced to `usa_epa` via `customLocalAqis`) as the **primary alert index** — higher-is-worse, `aqi > 100` matches the brief examples (`AQI: 180`).
2. Still requests **UAQI** for enrichment and as a **fallback** when a response carries no local index. Fallback alerts when `UAQI < UAQI_CRITICAL_FLOOR` (default `40`). See [Oman coverage](#oman-om-coverage) for why Muscat needs this path.
3. Documents the primary index on every event: `indexCode` + `scaleDirection`.
4. Uses **hysteresis** so brief dips around the enter threshold do not clear state or re-alert:

| Parameter | Enter (critical) | Exit (healthy) |
|-----------|------------------|----------------|
| Local AQI (`usa_epa`) | `> 100` | `<= 90` |
| UAQI fallback | `< 40` | `>= 50` |
| PM2.5 | `> 100 μg/m³` | `<= 90` |
| PM10 | `> 150 μg/m³` | `<= 135` |

Values between enter and exit are a **hold** band: no new alert and no recovery.

## Design decisions

### Transactional Outbox
Publishing directly to RabbitMQ after an in-memory dedup check could lose alerts when the broker is down.

Instead the collector, in **one Postgres transaction**:
1. Evaluates per-city dedup / cooldown (`city_alert_states`)
2. Inserts the alert payload into `outbox_messages` when allowed

A background **OutboxRelay** publishes pending rows with **exponential backoff** (`nextAttemptAt`). After max attempts the row is marked `failedAt` (no infinite loop).

### RabbitMQ durability + DLQ
- Messages are published with **`persistent: true`** to a **durable** queue.
- Transient consumer failures **nack without requeue** → retry queue (TTL) → back to main.
- Validation errors or max delivery attempts → **DLQ** (`air_quality.alerts.dlq`).

> If you change queue arguments after a previous run, delete the old queues in the management UI (`:15672`) or run `docker compose down` (no RabbitMQ volume is persisted).

### Alert deduplication + hysteresis
An alert is enqueued only when values **cross into** critical territory, or still critical **and** `ALERT_COOLDOWN_MS` (default **5 minutes**) has elapsed. Recovery requires all signals to pass **exit** thresholds (hysteresis); the grey band is `hold` and does not call `markHealthy`.

### Idempotent processor writes
`eventId` is unique. Concurrent duplicates use create-or-get (`P2002`) so only the first insert logs critically and broadcasts WebSocket.

### Health endpoints
| Path | Meaning |
|------|---------|
| `GET /health/live` | Process up (Compose healthcheck) |
| `GET /health/ready` | DB + RabbitMQ topology |
| `GET /health` | Alias for **ready** |

### Failure isolation
- Google API failure for one city does not stop the others (`Promise.allSettled`).
- RabbitMQ publish failure leaves the outbox row unpublished; the relay retries with backoff.
- Processor consumer **acks** on success; transient → retry queue; poison → DLQ.
- If DLQ publish fails for a permanent failure, the consumer **nacks without requeue** (no hot loop).

See also [docs/ARCHITECTURE-REPORT.md](./docs/ARCHITECTURE-REPORT.md).

## Trade-offs

- **Transactional Outbox** is kept so publish intent survives broker downtime. Delivery is **at-least-once**, not exactly-once; the processor’s unique `eventId` makes duplicate publishes safe.
- **Single-replica collector**: the outbox relay does not use `SELECT FOR UPDATE SKIP LOCKED`. Horizontal scale needs a claim strategy.
- **RabbitMQ has no Compose volume** (Postgres only). Recreating the broker can drop messages that the outbox already marked published.
- **`npm run smoke`** proves mock → collector → RMQ → processor → `/alerts`. A fuller black-box suite is still deferred.

## Google API vs mock mode

```env
AQI_PROVIDER=mock
MOCK_CRITICAL_CITIES=Dubai,Doha,Muscat
```

Mock behaviour:
- **Dubai / Doha / Riyadh:** `usa_epa`-style LAQI (0–500).
- **Muscat:** UAQI-only (0–100, lower-is-worse) to exercise the OM fallback path.

Switch to `AQI_PROVIDER=google` and set `GOOGLE_AQI_API_KEY` when billing is available.

### Live API verification

The Google provider was **not exercised against the live API**, because the Air Quality API requires a billing-enabled Google Cloud project. Instead:

- The end-to-end flow is validated with the deterministic **mock provider** (`npm run smoke`).
- Request shape, response mapping, index selection, and threshold logic are covered by **unit tests** against recorded response structures.
- Switching to the live API is a config change only (`AQI_PROVIDER=google` + `GOOGLE_AQI_API_KEY`); no code path is mock-specific beyond the provider binding.

### Oman (OM) coverage

Google’s [supported countries table](https://developers.google.com/maps/documentation/air-quality/coverage) does **not currently list Oman**, so a `LOCAL_AQI` index should not be expected for Muscat. The collector handles this as follows:

| Response for Muscat | Behaviour |
|---------------------|-----------|
| UAQI present, no local index | UAQI becomes the primary index (`lower_is_worse`), alerting below `UAQI_CRITICAL_FLOOR` |
| Some other local index present | That index is used and the substitution is logged |
| No usable index / request rejected | The Muscat poll fails and is logged; **the other three cities are unaffected** (`Promise.allSettled`) |

Mock mode returns UAQI-only data for Muscat so this fallback path is observable in the demo. No synthetic data is injected in `google` mode.

**Secrets:** never commit a real API key. If a live key was shared in a zip/folder, **rotate it** in Google Cloud Console. Compose passes the key only to the **collector**, not the processor.

## Quick start (Docker)

1. Copy env file (defaults to mock provider):

```bash
cp .env.example .env
```

2. Start the stack:

```bash
docker compose up --build
```

This runs: Postgres → migrate (once) → RabbitMQ → processor → collector.

3. Verify:

| Check | URL |
|-------|-----|
| Collector live | http://localhost:3001/health/live |
| Collector ready | http://localhost:3001/health/ready |
| Processor live | http://localhost:3002/health/live |
| Processor ready | http://localhost:3002/health/ready |
| Recent alerts | http://localhost:3002/alerts |
| RabbitMQ UI | http://localhost:15672 (user/pass from `.env`) |
| WebSocket | Socket.IO at `http://localhost:3002/alerts-ws` — event name `alert` |

4. Or run the smoke script (after the stack is up):

```bash
npm run smoke
```

## Local development

```bash
npm install
cp .env.example .env
# Infra with host ports 5432 and 5672 published:
docker compose up postgres rabbitmq -d

npx prisma migrate deploy
npm run start:processor:dev
# other terminal
npm run start:collector:dev
```

## API

### `GET /alerts`
Returns up to 20 most recent alerts:

```json
[
  {
    "city": "Doha",
    "aqi": 176,
    "category": "Unhealthy",
    "timestamp": "2025-11-02T10:30:00.000Z"
  }
]
```

### WebSocket
Connect to path `/alerts-ws`. On each persisted alert the server emits:

```json
{ "city": "Dubai", "aqi": 180, "category": "Unhealthy", "timestamp": "..." }
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build both apps |
| `npm run format:check` | Prettier check |
| `npm run lint` | ESLint (no auto-fix) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` / `test:unit` | Unit tests |
| `npm run test:cov` | Unit tests + coverage thresholds |
| `npm run test:ci` | format + lint + typecheck + unit + build |
| `npm run start:collector:dev` | Collector watch mode |
| `npm run start:processor:dev` | Processor watch mode |
| `npm run prisma:migrate` | Create/apply migrations |
| `npm run smoke` | Compose happy-path: `/health` then wait for `/alerts` |

CI gates on format/lint/typecheck/unit/build. `npm run smoke` proves the Docker happy path locally; a fuller black-box suite remains P2.

## Project layout

```text
apps/collector/     Data Collector microservice
apps/processor/     Alert Processor microservice (hybrid)
libs/               Shared contracts & infrastructure
prisma/             Alert schema + migrations
docker/             Per-service Dockerfiles + migrate image
docker-compose.yml  migrate + collector + processor + rabbitmq + postgres
```
