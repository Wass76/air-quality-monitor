# Air Quality Monitor — Architecture Design Report

**Stack:** NestJS monorepo · RabbitMQ (persistent + DLQ) · Postgres/Prisma · Local AQI (`usa_epa`) + UAQI fallback

---

## 1. Evaluation findings

| Finding | Severity | Impact |
|---------|----------|--------|
| E2E flow (poll → threshold → outbox → RMQ → persist → REST/WS) | Strength | Mandatory correctness |
| Monorepo: collector + processor + shared libs | Strength | Clear service boundaries |
| Alert dedup / cooldown (edge-cross + 5m) | Strength | Prevents queue flood every 10s |
| Transactional Outbox + backoff / `failedAt` | Strength | Durable publish intent; no infinite retry |
| Persistent RMQ messages + durable queues | Strength | Survive broker restart after confirm |
| DLQ + retry TTL topology | Strength | Poison messages isolated |
| LOCAL_AQI (`usa_epa`) as primary alert index | Strength | Matches `AQI > 100` / example 180 |
| UAQI fallback for Muscat / OM | Strength | Coverage gap does not silence alerts |
| Mock mirrors real scales (LAQI vs UAQI) | Strength | Does not hide UAQI bug |
| Auth / Redis / CDK | Low / optional | Future P2 |

---

## 2. AQI contract

Assignment text asked for **UAQI > 100**. Google Universal AQI is **0–100, higher = better**, so that threshold never fires.

**Implemented contract:**

1. Request `LOCAL_AQI` + `POLLUTANT_CONCENTRATION` + `customLocalAqis` → `usa_epa`.
2. Primary alert on Local AQI when `aqi > 100` (`scaleDirection: higher_is_worse`).
3. If no local index (e.g. Muscat), fall back to UAQI with `aqi < UAQI_CRITICAL_FLOOR` (`UAQI_LOW`).
4. Persist `indexCode`, `scaleDirection`, `uaqi` on every alert.

---

## 3. Dedup + Outbox + Hysteresis

Polling every **10 seconds** while air stays unhealthy would flood the queue. Dedup publishes on edge-cross or after cooldown.

**Hysteresis:** evaluator returns `critical | healthy | hold`. Hold does not enqueue and does not clear `wasExceeding`, so `101→99→101` does not re-alert until recovery (`<= 90` LAQI / `>= 50` UAQI).

**Transactional Outbox:**

1. One DB transaction: evaluate dedup → `INSERT outbox_messages` → update `city_alert_states`.
2. Relay publishes with confirm; only then sets `published_at`.
3. Failures set `nextAttemptAt` (exponential backoff) or `failedAt` after max attempts.

**Processor idempotency:** `createOrGetByEventId` catches Prisma `P2002`; duplicates ack without extra log/WebSocket.

**Health:** `/health/live` for Compose; `/health/ready` for DB + RMQ topology.

**CI:** GitHub Actions runs format, lint, typecheck, unit tests, coverage, build. A Compose smoke script covers the happy path; deeper black-box E2E remains P2.

**Known limits (intentional for this scope):**
- Outbox is **at-least-once** (timeout after broker accept can republish); processor idempotency via unique `eventId` is the defense.
- Outbox relay is **single-replica** (no `SKIP LOCKED` / claim).
- Compose persists Postgres only; **RabbitMQ has no volume** — recreate may drop in-flight messages after outbox marks published.
- Nest validation rejects **before** the handler may skip the manual DLQ path.

---

## 4. End-to-end process flow

```text
Google / Mock API
        │
        ▼
Collector (:3001)
  Scheduler → Poll → Threshold → Dedup+Outbox (TX) → OutboxRelay → RMQ
        │
        ▼  air_quality.alerts ⇄ retry (TTL) → air_quality.alerts.dlq
Processor (:3002)
  Consumer → Validate → Log → Alerts table → REST + WebSocket
```

---

## 5. Where Redis fits (design thinking — not required for P0)

| Layer | Role |
|-------|------|
| RabbitMQ | Durable event transport |
| Postgres | Source of truth (alerts + outbox + city state) |
| Redis | Fast coordination + cache + distributed locks |

| Concern | Today | With Redis |
|---------|-------|------------|
| Dedup / cooldown | `city_alert_states` | Optional hot path |
| Poll lock / leader | `inFlight` per process | `SETNX poll:lock` TTL |
| `GET /alerts` cache | Always Postgres | Short-TTL cache |
| WebSocket fan-out | Single node | Redis Pub/Sub |

---

## 6. Remaining P1 / P2 items

| Item | Priority |
|------|----------|
| Deeper Compose black-box / integration suite beyond smoke | P1 |
| RabbitMQ health that detects broker death after connect | P1 |
| Redis poll lock + outbox `SKIP LOCKED` | P2 |
| Auth on REST/WS | P2 |
| Circuit breaker on Google | P2 |
| AWS CDK / metrics | P2 |

---

## Recommended evolution order

1. ~~LOCAL_AQI contract + UAQI fallback~~ (done)
2. ~~Persistent messages + shared queue options~~ (done)
3. ~~DLQ + consumer retry budget + outbox backoff~~ (done)
4. ~~Clean compose run (ports, migrate job, least-privilege env)~~ (done)
5. ~~Hysteresis + lint CI gate~~ (done)
6. ~~Compose smoke script~~ (done)
7. Deeper integration tests + Redis lock
8. Auth + AWS deployment sketch
